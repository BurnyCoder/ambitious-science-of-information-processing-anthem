"""Song phase: content/ -> two Suno takes on disk (+ word timings), cached.

Local: loads the hand-written song spec (content/song.toml + content/lyrics.txt), checks
it against the documented V6 field limits and banned words, then either reuses data/song/song.json,
pays for one generation, or re-sings a few lines of the cached take (replace section); it downloads
the takes + covers and stores each take's raw timestamped-lyrics JSON.
Global context: first phase of pipeline.run(); later phases (alignment, take selection,
timeline) read only the cache written here, so re-running the pipeline never spends
credits again unless --regenerate-song or --replace-lines is passed.
Sources:
- field limits (title 80, style 1000, lyrics 5000 for V6): https://docs.sunoapi.org/suno-api/generate-music
- replace-section window limits (>= 10 s, <= 50%): https://docs.sunoapi.org/suno-api/replace-section
- tomllib: https://docs.python.org/3/library/tomllib.html
- file retention (download promptly): https://docs.sunoapi.org/suno-api/quickstart
"""

import hashlib  # fingerprint the spec so a stale cache is detectable
import json  # cache file format
import logging  # phase progress
import re  # banned-word check
import tomllib  # stdlib TOML parser for content/song.toml
from dataclasses import asdict, dataclass  # spec/take records
from datetime import datetime, timezone  # cache timestamp
from pathlib import Path  # file paths

from anthem.config import ConfigError, Settings  # paths + Suno parameters
from anthem.suno_client import SunoError  # alignment failures are tolerated, not fatal

log = logging.getLogger(__name__)  # module logger

LIMITS = {"title": 80, "style": 1000, "lyrics": 5000, "negative_tags": 1000}  # V6 maxima from the docs
MIN_INFILL_S, MAX_INFILL_SHARE = 10.0, 0.5  # replace-section window: >= 10 s, <= 50% of the take (docs)


class SpecError(ValueError):
    """Local: the song spec violates a documented limit.  Global: caught before any paid call."""


@dataclass(frozen=True)
class SongSpec:
    """Local: everything we send to Suno.  Global: written by hand in content/, versioned in git."""

    title: str
    style: str
    lyrics: str
    negative_tags: str
    vocal_gender: str

    def fingerprint(self) -> str:
        """Local: sha256 of the spec.  Global: detects lyrics edited after the cached generation."""
        return hashlib.sha256(json.dumps(asdict(self), sort_keys=True).encode()).hexdigest()  # stable hash


@dataclass(frozen=True)
class Take:
    """Local: one downloaded take.  Global: alignment/timeline phases consume these paths."""

    id: str  # Suno audioId
    audio_path: Path  # local MP3
    image_path: Path | None  # local cover art (may be absent)
    aligned_path: Path  # raw timestamped-lyrics JSON for this take
    duration: float | None  # seconds reported by Suno
    title: str | None
    tags: str | None


@dataclass(frozen=True)
class Song:
    """Local: one generation task and its takes.  Global: return value of the song phase."""

    task_id: str
    takes: list[Take]


def load_song_spec(content_dir: Path) -> SongSpec:
    """Local: read song.toml + lyrics.txt and enforce documented limits.
    Global: the creative input of the whole pipeline."""
    meta = tomllib.loads((content_dir / "song.toml").read_text(encoding="utf-8"))  # title/style/negatives/gender
    spec = SongSpec(
        title=meta["title"], style=meta["style"],
        lyrics=(content_dir / "lyrics.txt").read_text(encoding="utf-8").strip(),  # Suno [Section]-tagged lyrics
        negative_tags=meta.get("negative_tags", ""), vocal_gender=meta.get("vocal_gender", "m"),
    )
    for field, limit in LIMITS.items():  # every limited field
        if len(getattr(spec, field)) > limit:  # too long -> the API would reject or truncate it
            raise SpecError(f"{field} is {len(getattr(spec, field))} chars; Suno V6 allows {limit}")
    for word in meta.get("banned_words", []):  # words the author never wants sung (checked here, not sent)
        if re.search(rf"\b{re.escape(word)}", spec.lyrics, re.IGNORECASE):  # word-start match: mind, Mind's, minds
            raise SpecError(f"lyrics contain the banned word {word!r} (content/song.toml banned_words)")
    return spec


def _cache_path(settings: Settings) -> Path:
    return settings.song_dir / "song.json"  # single cache file for the current song


def load_cached_song(settings: Settings, spec: SongSpec) -> Song | None:
    """Local: rebuild Song from song.json if it exists.  Global: avoids re-spending credits."""
    path = _cache_path(settings)  # cache location
    if not path.exists():  # first run
        return None
    data = json.loads(path.read_text(encoding="utf-8"))  # stored metadata
    if data.get("spec_sha256") != spec.fingerprint():  # lyrics/style changed since generation
        log.warning("content/ changed since the cached song was generated; reusing it anyway "
                    "(pass --regenerate-song to pay for a new generation)")
    base = settings.song_dir  # stored paths are relative to song_dir (portable clones)
    takes = [Take(id=t["id"], audio_path=base / t["audio_path"],
                  image_path=base / t["image_path"] if t["image_path"] else None,
                  aligned_path=base / t["aligned_path"], duration=t["duration"],
                  title=t["title"], tags=t["tags"]) for t in data["takes"]]  # rebuild records
    log.info("Reusing cached song task %s with %d takes from %s", data["task_id"], len(takes), path)
    return Song(task_id=data["task_id"], takes=takes)


def generate_or_load_song(settings: Settings, client, spec: SongSpec, regenerate: bool = False) -> Song:
    """Local: return the cached song, or generate, download and cache a new one.
    Global: phase 1 of the pipeline; `client` is a SunoClient (or a test fake)."""
    if not regenerate and (cached := load_cached_song(settings, spec)):  # cheap path
        return cached
    _require_key(settings)  # only a fresh generation needs the key
    log.info("Remaining Suno credits before generation: %s", client.credits())  # cost visibility
    task_id = client.generate(lyrics=spec.lyrics, style=spec.style, title=spec.title, model=settings.suno_model,
                              duration=settings.song_duration_s, negative_tags=spec.negative_tags,
                              vocal_gender=spec.vocal_gender, callback_url=settings.callback_url)  # paid call
    return _download_and_cache(settings, client, spec, task_id)  # poll, download, write song.json


def infill_window(words, first: int, last: int) -> tuple[float, float]:
    """Local: (start, end) from the middle of the gap before line `first` to the middle of the gap after `last`.
    Global: the replace-section window cuts between sung words, so no neighbouring word is clipped."""
    inside = [w for w in words if first <= w.line_index <= last]  # words to re-sing
    before = [w for w in words if w.line_index < first]  # kept words before the window
    after = [w for w in words if w.line_index > last]  # kept words after it
    start = (before[-1].end + inside[0].start) / 2 if before else 0.0  # gap midpoint (or song start)
    end = (inside[-1].end + after[0].start) / 2 if after else inside[-1].end  # gap midpoint (or last word)
    return start, end


def replace_lines(settings: Settings, client, spec: SongSpec, first: int, last: int,
                  forced_take: str | None = None, resume_task: str | None = None) -> Song:
    """Local: re-sing written lines first..last (0-based, as in timeline.json) of the cached take with the
    current lyrics, then download and cache the result as the new song. resume_task caches an already
    paid replace task instead of submitting a new one (e.g. after a failed caching step).
    Global: paid lyric fix (--replace-lines); the rest of the take is kept, so per-take results still apply."""
    from anthem.alignment import align_words  # local imports: take_selection imports this module
    from anthem.lyrics import parse_lyrics  # written lines
    from anthem.take_selection import select_take  # same pre-specified rule as the timeline phase
    from anthem.timeline import shift_words  # exp05 onset correction -> real audio time
    song = load_cached_song(settings, spec)  # the take to edit
    if song is None:
        raise FileNotFoundError(f"No cached song in {settings.song_dir}; generate one first")
    _require_key(settings)  # a paid call follows
    sections = parse_lyrics(spec.lyrics)  # new lyrics; changed words simply stay unmatched in the old take
    take, _ = select_take(song, sections, forced_take)  # source take
    raw = json.loads(take.aligned_path.read_text(encoding="utf-8"))  # its Suno word timings
    words = shift_words(align_words(sections, raw["alignedWords"])[0], settings.word_offset_s)  # audio time
    start, end = infill_window(words, first, last)  # cut between sung words
    if not MIN_INFILL_S <= end - start <= MAX_INFILL_SHARE * (take.duration or 0):  # documented API limits
        raise SpecError(f"window {start:.2f}-{end:.2f} s is {end - start:.2f} s long; replace-section needs "
                        f">= {MIN_INFILL_S} s and <= {MAX_INFILL_SHARE:.0%} of the take")
    segment = "\n".join(ln.text for s in sections for ln in s.lines if first <= ln.index <= last)  # new words
    log.info("Replacing lines %d-%d of take %s at %.2f-%.2f s with:\n%s", first, last, take.id, start, end, segment)
    log.info("Remaining Suno credits before replacement: %s", client.credits())  # cost visibility
    task_id = resume_task or client.replace_section(
        task_id=song.task_id, audio_id=take.id, segment_lyrics=segment, full_lyrics=spec.lyrics, tags=spec.style,
        title=spec.title, start_s=start, end_s=end, negative_tags=spec.negative_tags,
        vocal_gender=spec.vocal_gender, callback_url=settings.callback_url)  # paid call (skipped when resuming)
    parent = {"task_id": song.task_id, "take_id": take.id, "infill_s": [round(start, 2), round(end, 2)],
              "lines": [first, last]}  # provenance of the edit
    new = _download_and_cache(settings, client, spec, task_id, extra={"parent": parent}, expect_s=take.duration)
    log.info("Remaining Suno credits after replacement: %s", client.credits())  # what the edit cost
    return new


def _require_key(settings: Settings) -> None:
    """Local: fail fast without a key.  Global: every paid call checks this first."""
    if not settings.suno_api_key:
        raise ConfigError("SUNO_API_KEY is missing: copy .env.example to .env and set your sunoapi.org key")


def _download_and_cache(settings: Settings, client, spec: SongSpec, task_id: str, extra: dict | None = None,
                        expect_s: float | None = None) -> Song:
    """Local: poll task_id, download every take, its cover and word timings, then write song.json.
    Global: shared tail of a generation and a section replacement. With expect_s, only takes lasting within
    1 s of it are cached; if none does, song.json is left untouched (the paid files stay on disk)."""
    log.info("Submitted Suno task %s; polling every %ss", task_id, settings.poll_interval_s)
    tracks = client.wait_for(task_id, poll_interval=settings.poll_interval_s, timeout=settings.timeout_s)  # block
    task_dir = settings.song_dir / task_id  # one folder per generation
    task_dir.mkdir(parents=True, exist_ok=True)  # also creates data/song/ for the cache file
    takes, records = [], []  # Take objects + JSON-serializable records
    for i, track in enumerate(tracks, start=1):  # usually two takes per generation
        audio = task_dir / f"take{i}_{track.id}.mp3"  # local audio path
        client.download(track.audio_url, audio)  # fetch MP3 before retention expires
        image = task_dir / f"take{i}_{track.id}.jpg" if track.image_url else None  # cover is optional
        if image:
            client.download(track.image_url, image)  # fetch cover art
        aligned = task_dir / f"take{i}_{track.id}_aligned.json"  # word timings for this take
        try:
            timings = client.timestamped_lyrics(task_id, track.id)  # raw alignedWords + hootCer
        except SunoError as err:  # keep the paid audio even if alignment is unavailable
            log.warning("Timestamped lyrics failed for take %s: %s", track.id, err)
            timings = {"error": str(err)}  # take selection will rank this take last
        aligned.write_text(json.dumps(timings, indent=2, ensure_ascii=False), encoding="utf-8")  # raw, verbatim
        takes.append(Take(track.id, audio, image, aligned, track.duration, track.title, track.tags))
        records.append({"id": track.id, "audio_path": audio.relative_to(settings.song_dir).as_posix(),
                        "image_path": image.relative_to(settings.song_dir).as_posix() if image else None,
                        "aligned_path": aligned.relative_to(settings.song_dir).as_posix(),
                        "duration": track.duration, "title": track.title, "tags": track.tags,
                        "audio_url": track.audio_url, "image_url": track.image_url})
    if expect_s is not None:  # a replacement must return the whole song (exp06 check a, per take)
        full = [abs((t.duration or 0) - expect_s) <= 1.0 for t in takes]  # within 1 s of the source take
        if not any(full):  # e.g. only the segment came back
            raise SunoError(None, f"take durations {[t.duration for t in takes]} differ from {expect_s} s; "
                                  f"files kept in {task_dir}, song.json unchanged")
        dropped = [r for r, ok in zip(records, full) if not ok]  # kept on disk, recorded in song.json
        for r in dropped:
            log.warning("Dropping take %s: %s s is not the %s s song", r["id"], r["duration"], expect_s)
        takes, records = [t for t, ok in zip(takes, full) if ok], [r for r, ok in zip(records, full) if ok]
        extra = {**(extra or {}), "dropped_takes": dropped}  # provenance of what was paid for
    _cache_path(settings).write_text(json.dumps({  # cache for every later run
        "task_id": task_id, "model": settings.suno_model, "spec_sha256": spec.fingerprint(),
        "created_utc": datetime.now(timezone.utc).isoformat(), **(extra or {}), "takes": records},
        indent=2), encoding="utf-8")
    log.info("Song cached at %s", _cache_path(settings))
    return Song(task_id=task_id, takes=takes)


def produce_song(settings: Settings, regenerate: bool = False, replace: tuple[int, int] | None = None,
                 forced_take: str | None = None, resume_task: str | None = None) -> Song:
    """Local: load content/, build the real client, then reuse, generate, or replace lines.
    Global: the "song" phase as called by pipeline.run()."""
    from anthem.suno_client import SunoClient  # local import keeps tests free of real-client construction
    spec = load_song_spec(settings.content_dir)  # hand-written lyrics + style
    client = SunoClient(settings.suno_api_key, settings.suno_base_url)  # network boundary
    if replace:  # --replace-lines FIRST LAST: paid re-sing of part of the cached take
        song = replace_lines(settings, client, spec, *replace, forced_take=forced_take, resume_task=resume_task)
    else:
        song = generate_or_load_song(settings, client, spec, regenerate=regenerate)  # paid at most once
    log.info("Song task %s takes: %s", song.task_id, [t.audio_path.name for t in song.takes])
    return song
