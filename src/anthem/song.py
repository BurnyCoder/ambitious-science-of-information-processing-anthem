"""Song phase: content/ -> two Suno takes on disk (+ word timings), cached.

Local: loads the hand-written song spec (content/song.toml + content/lyrics.txt), checks
it against the documented V6 field limits, then either reuses data/song/song.json or
pays for one generation, downloads both takes + covers, and stores each take's raw
timestamped-lyrics JSON.
Global context: first phase of pipeline.run(); later phases (alignment, take selection,
timeline) read only the cache written here, so re-running the pipeline never spends
credits again unless --regenerate-song is passed.
Sources:
- field limits (title 80, style 1000, lyrics 5000 for V6): https://docs.sunoapi.org/suno-api/generate-music
- tomllib: https://docs.python.org/3/library/tomllib.html
- file retention (download promptly): https://docs.sunoapi.org/suno-api/quickstart
"""

import hashlib  # fingerprint the spec so a stale cache is detectable
import json  # cache file format
import logging  # phase progress
import tomllib  # stdlib TOML parser for content/song.toml
from dataclasses import asdict, dataclass  # spec/take records
from datetime import datetime, timezone  # cache timestamp
from pathlib import Path  # file paths

from anthem.config import Settings  # paths + Suno parameters
from anthem.suno_client import SunoError  # alignment failures are tolerated, not fatal

log = logging.getLogger(__name__)  # module logger

LIMITS = {"title": 80, "style": 1000, "lyrics": 5000, "negative_tags": 1000}  # V6 maxima from the docs


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
    return spec


def _cache_path(settings: Settings) -> Path:
    return settings.song_dir / "song.json"  # single cache file for the current song


def _load_cache(settings: Settings, spec: SongSpec) -> Song | None:
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
    if not regenerate and (cached := _load_cache(settings, spec)):  # cheap path
        return cached
    log.info("Remaining Suno credits before generation: %s", client.credits())  # cost visibility
    task_id = client.generate(lyrics=spec.lyrics, style=spec.style, title=spec.title, model=settings.suno_model,
                              duration=settings.song_duration_s, negative_tags=spec.negative_tags,
                              vocal_gender=spec.vocal_gender, callback_url=settings.callback_url)  # paid call
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
    _cache_path(settings).write_text(json.dumps({  # cache for every later run
        "task_id": task_id, "model": settings.suno_model, "spec_sha256": spec.fingerprint(),
        "created_utc": datetime.now(timezone.utc).isoformat(), "takes": records}, indent=2), encoding="utf-8")
    log.info("Song cached at %s", _cache_path(settings))
    return Song(task_id=task_id, takes=takes)
