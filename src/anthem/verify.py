"""Verify phase: check the rendered MP4 against the timeline and extract inspection stills.

Local: reads stream/format metadata with ffprobe, checks resolution, frame rate, codecs
and duration (within 0.5 s of the song), and grabs one PNG from the middle of every
section with ffmpeg, writing a JSON report next to the video.
Global context: the automated acceptance gate at the end of the pipeline; the stills are
what a human (or Claude's image reading) inspects for legibility and scene order.
Sources: ffprobe -show_streams -show_format -of json https://ffmpeg.org/ffprobe.html ,
         ffmpeg -ss seeking + -frames:v 1 https://trac.ffmpeg.org/wiki/Seeking
"""

import json  # ffprobe output + report
import logging  # results
import subprocess  # ffprobe / ffmpeg
from fractions import Fraction  # "30/1" -> 30
from pathlib import Path  # paths

from anthem.logging_setup import log_json  # full report in the log

log = logging.getLogger(__name__)  # module logger

DURATION_TOLERANCE_S = 0.5  # video may differ from the song by less than this


def probe(video: Path) -> dict:
    """Local: ffprobe metadata as a dict.  Global: input of check_probe()."""
    out = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)],
                         check=True, capture_output=True, text=True)  # JSON on stdout
    return json.loads(out.stdout)


def check_probe(meta: dict, width: int, height: int, fps: int, duration_s: float) -> list[str]:
    """Local: list of human-readable problems (empty = pass).  Global: pure, unit-tested acceptance rules."""
    problems = []  # collected failures
    video = next((s for s in meta["streams"] if s.get("codec_type") == "video"), None)  # first video stream
    audio = next((s for s in meta["streams"] if s.get("codec_type") == "audio"), None)  # first audio stream
    if video is None:
        problems.append("no video stream")
    else:
        if (video.get("width"), video.get("height")) != (width, height):  # resolution
            problems.append(f"resolution {video.get('width')}x{video.get('height')} != {width}x{height}")
        if video.get("codec_name") != "h264":  # Remotion's default codec
            problems.append(f"video codec {video.get('codec_name')} != h264")
        if Fraction(video.get("r_frame_rate", "0/1")) != fps:  # exact frame rate
            problems.append(f"frame rate {video.get('r_frame_rate')} != {fps}")
    if audio is None:
        problems.append("no audio stream")
    elif audio.get("codec_name") != "aac":
        problems.append(f"audio codec {audio.get('codec_name')} != aac")
    dur = float(meta.get("format", {}).get("duration", 0))  # container duration
    if abs(dur - duration_s) > DURATION_TOLERANCE_S:  # video must cover the whole song
        problems.append(f"duration {dur:.2f}s differs from song {duration_s:.2f}s by > {DURATION_TOLERANCE_S}s")
    return problems


def extract_stills(video: Path, timeline: dict, stills_dir: Path) -> list[Path]:
    """Local: one PNG per section midpoint.  Global: visual inspection of every scene in the final file."""
    stills_dir.mkdir(parents=True, exist_ok=True)  # out/stills
    paths = []  # written files
    for i, s in enumerate(timeline["sections"], start=1):  # every scene
        t = (s["startS"] + s["endS"]) / 2  # midpoint
        path = stills_dir / f"verify_s{i:02d}_{s['scene']}.png"  # e.g. verify_s04_chorus.png
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1", str(path)],
                       check=True)  # fast input seek, decode one frame
        paths.append(path)
    return paths


def verify_video(video: Path, timeline: dict, stills_dir: Path, width: int = 1920, height: int = 1080) -> dict:
    """Local: probe + checks + stills + JSON report.  Global: the "verify" phase; report["ok"] gates success."""
    problems = check_probe(probe(video), width, height, timeline["fps"], timeline["durationS"])  # acceptance rules
    stills = extract_stills(video, timeline, stills_dir)  # inspection images
    report = {"video": str(video), "ok": not problems, "problems": problems, "stills": [str(p) for p in stills]}
    (video.parent / f"{video.stem}_verify.json").write_text(json.dumps(report, indent=2), encoding="utf-8")  # artifact
    log_json(log, "Verification report", report)  # full report in the run log
    return report
