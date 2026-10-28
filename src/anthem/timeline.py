"""Build timeline.json: the contract between the Python pipeline and the Remotion video.

Local: combines sections (scene per section, boundaries snapped to beats), lines and
timed words (karaoke), and the per-frame audio features into one JSON document, and
copies the chosen take next to it in video/public/.
Global context: last Python phase before rendering; video/src/lib/timeline.ts declares
the same shape in TypeScript and every scene reads only this file.
Sources:
- Remotion serves video/public/ via staticFile(): https://www.remotion.dev/docs/staticfile
- dataclasses.replace: https://docs.python.org/3/library/dataclasses.html#dataclasses.replace
- scene map in TOML (tomllib): https://docs.python.org/3/library/tomllib.html
"""

import json  # output format
import logging  # summary
import shutil  # copy the chosen MP3
import tomllib  # content/scenes.toml
from dataclasses import replace  # copy a TimedWord with new times
from pathlib import Path  # paths

from anthem.alignment import TimedWord  # karaoke words
from anthem.audio_analysis import AudioAnalysis  # beats + energy
from anthem.lyrics import Section, section_keys  # song structure + config-key lookup
from anthem.vignettes import load_vignettes, place_vignettes, vignette_coverage  # illustration track

log = logging.getLogger(__name__)  # module logger

LEAD_S = 0.1  # cut a hair before the first sung word of a section
SNAP_WINDOW_S = 0.3  # only snap a cut to a beat closer than this


def snap_to_beat(t: float, beats: list[float], window: float = SNAP_WINDOW_S) -> float:
    """Local: nearest beat to t if within window, else t.  Global: makes scene cuts land on the beat."""
    if not beats:  # no rhythm information
        return t
    nearest = min(beats, key=lambda b: abs(b - t))  # O(n) is fine for ~500 beats
    return nearest if abs(nearest - t) <= window else t  # never move a cut far


def shift_words(words: list[TimedWord], offset_s: float) -> list[TimedWord]:
    """Local: add offset_s to every word's start and end, clamped at the song start.
    Global: the global onset correction of reports/exp05 (VIDEO_WORD_OFFSET_S); section cuts follow the
    shifted first words, so karaoke and cuts move together. Take-specific: calibrated by exp05 on take 1
    and re-estimated by exp06 for the edited take that replaced it."""
    if not offset_s:  # default: Suno's own timings
        return words
    return [replace(w, start=max(0.0, w.start + offset_s), end=max(0.0, w.end + offset_s)) for w in words]  # copy


def load_scene_map(path: Path) -> dict[str, str]:
    """Local: read content/scenes.toml.  Global: which visual scene plays during which song section."""
    return tomllib.loads(path.read_text(encoding="utf-8"))["scenes"]  # {"verse 1": "layers", ...}


def _scene_for(section: Section, scene_map: dict[str, str]) -> str:
    """Local: "<kind> <occurrence>" first, then "<kind>", then "default".  Global: repeated choruses share a scene."""
    return next((scene_map[k] for k in section_keys(section.kind, section.occurrence) if k in scene_map), "default")


def _r(x: float) -> float:
    return round(float(x), 3)  # millisecond precision keeps the JSON small


def build_timeline(sections: list[Section], words: list[TimedWord], audio: AudioAnalysis, fps: int,
                   title: str, scene_map: dict[str, str], meta: dict | None = None, vignettes: dict | None = None) -> dict:
    """Local: assemble the timeline dict; `vignettes` is load_vignettes()'s spec (None = no cards).
    Global: everything the video needs, in seconds + frame counts."""
    starts = []  # (section, raw start) for sections that contain timed words
    for sec in sections:
        sec_words = [w for w in words if w.section_index == sec.index]  # its words
        if not sec_words:  # nothing sung here -> merged into the previous scene
            log.warning("Section %s has no words; it gets no scene of its own", sec.label)
            continue
        starts.append((sec, sec_words[0].start))  # first sung word
    out_sections = []  # serialized sections
    for i, (sec, first) in enumerate(starts):
        start = 0.0 if i == 0 else snap_to_beat(first - LEAD_S, audio.beat_times)  # first scene starts the video
        if out_sections:  # keep boundaries strictly increasing even after snapping
            start = max(start, out_sections[-1]["startS"] + 1.0 / fps)
            out_sections[-1]["endS"] = _r(start)  # previous scene ends where this one begins
        out_sections.append({"index": sec.index, "label": sec.label, "kind": sec.kind,
                             "occurrence": sec.occurrence, "scene": _scene_for(sec, scene_map),
                             "startS": _r(start), "endS": None})
    if out_sections:
        out_sections[-1]["endS"] = _r(audio.duration_s)  # last scene runs to the end of the song
    lines: dict[int, dict] = {}  # line index -> serialized line
    for w in words:  # group words into their lines
        line = lines.setdefault(w.line_index, {"index": w.line_index, "sectionIndex": w.section_index, "words": []})
        line["words"].append({"text": w.text, "startS": _r(w.start), "endS": _r(w.end), "backing": w.backing})
    for line in lines.values():  # line span + text from its words
        line["startS"], line["endS"] = line["words"][0]["startS"], line["words"][-1]["endS"]
        line["text"] = " ".join(x["text"] for x in line["words"])
        line["backing"] = all(x["backing"] for x in line["words"])  # whole line is a backing echo
    timeline = {
        "version": 4, "title": title, "fps": fps, "audio": "anthem.mp3",
        "durationS": _r(audio.duration_s), "durationInFrames": int(round(audio.duration_s * fps)),
        "tempoBpm": _r(audio.tempo_bpm), "sections": out_sections,
        "lines": [lines[k] for k in sorted(lines)],
        "beats": [_r(b) for b in audio.beat_times], "downbeats": [_r(b) for b in audio.downbeats],
        "energy": [_r(v) for v in audio.energy], "onset": [_r(v) for v in audio.onset],
        "meta": meta or {},
    }
    timeline["vignettes"] = place_vignettes(vignettes, timeline) if vignettes else []  # timed figure cards
    return timeline


def write_timeline(timeline: dict, audio_src: Path, public_dir: Path) -> Path:
    """Local: write timeline.json and copy the MP3 into video/public/.  Global: hands off to Remotion."""
    public_dir.mkdir(parents=True, exist_ok=True)  # Remotion's static folder
    shutil.copyfile(audio_src, public_dir / timeline["audio"])  # anthem.mp3
    path = public_dir / "timeline.json"  # fetched by calculateMetadata()
    path.write_text(json.dumps(timeline, ensure_ascii=False), encoding="utf-8")  # compact
    log.info("Timeline: %d sections, %d lines, %d beats, %d frames -> %s", len(timeline["sections"]),
             len(timeline["lines"]), len(timeline["beats"]), timeline["durationInFrames"], path)
    return path


def cut_to_beat_error(timeline: dict) -> float | None:
    """Local: mean |scene cut - nearest beat| in seconds (first cut at 0 excluded).
    Global: the pre-specified beat-sync metric reported in reports/."""
    cuts = [s["startS"] for s in timeline["sections"][1:]]  # every cut after the opening scene
    if not cuts or not timeline["beats"]:
        return None
    return round(sum(min(abs(c - b) for b in timeline["beats"]) for c in cuts) / len(cuts), 4)  # seconds


def produce_timeline(settings, forced_take: str | None = None) -> Path:
    """Local: cached song -> chosen take -> aligned words + audio features -> video/public/timeline.json.
    Global: the "timeline" phase as called by pipeline.run(); needs no API key or network."""
    from anthem.alignment import align_words  # word timings
    from anthem.audio_analysis import analyze_audio  # beats + energy
    from anthem.lyrics import parse_lyrics  # written structure
    from anthem.song import load_cached_song, load_song_spec  # cached takes
    from anthem.take_selection import select_take  # pre-specified rule
    spec = load_song_spec(settings.content_dir)  # same lyrics that were sent to Suno
    song = load_cached_song(settings, spec)  # no network here
    if song is None:
        raise FileNotFoundError(f"No cached song in {settings.song_dir}; run `uv run anthem --stage song` first")
    sections = parse_lyrics(spec.lyrics)  # sections/lines/words
    take, scores = select_take(song, sections, forced_take)  # which audio to cut to
    raw = json.loads(take.aligned_path.read_text(encoding="utf-8"))  # Suno word timings of that take
    words, stats = align_words(sections, raw["alignedWords"])  # written words with repaired times
    words = shift_words(words, settings.word_offset_s)  # exp05 onset correction (0 by default)
    log.info("Alignment of take %s: %s; word offset %+.3f s", take.id, stats, settings.word_offset_s)
    audio = analyze_audio(take.audio_path, settings.fps)  # rhythm + loudness
    banned = tomllib.loads((settings.content_dir / "song.toml").read_text(encoding="utf-8")).get("banned_words", [])
    timeline = build_timeline(sections, words, audio, settings.fps, spec.title,
                              load_scene_map(settings.content_dir / "scenes.toml"),
                              meta={"taskId": song.task_id, "takeId": take.id, "alignment": stats,
                                    "wordOffsetS": settings.word_offset_s,
                                    "hootCer": raw.get("hootCer"), "takeScores": scores},
                              vignettes=load_vignettes(settings.content_dir / "vignettes.toml", banned))  # cards
    timeline["meta"]["cutToBeatErrorS"] = cut_to_beat_error(timeline)  # beat-sync metric
    timeline["meta"]["vignetteCoverage"] = vignette_coverage(timeline)  # share of sung lines with a card (target 1.0)
    log.info("Mean scene-cut distance to nearest beat: %s s; %d cards cover %s of sung lines",
             timeline["meta"]["cutToBeatErrorS"], len(timeline["vignettes"]), timeline["meta"]["vignetteCoverage"])
    return write_timeline(timeline, take.audio_path, settings.video_dir / "public")
