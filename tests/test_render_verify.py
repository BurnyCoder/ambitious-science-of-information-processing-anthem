"""Tests for anthem.render (command construction) and anthem.verify (output checks).

Local: the Remotion CLI command is built correctly (GL backend, concurrency, preview
scale/frame range), and the ffprobe-based checks accept a correct video and reject a
wrong one; one integration test builds a tiny real MP4 with ffmpeg.
Global context: these are the last two phases; verify is the automated gate that the
rendered MP4 matches the song (duration, resolution, fps, codecs).
Sources: Remotion render flags https://www.remotion.dev/docs/cli/render ,
ffprobe JSON output https://ffmpeg.org/ffprobe.html
"""

import json  # timeline fixture
import shutil  # skip if ffmpeg missing
import subprocess  # build the tiny MP4

import pytest  # skip / raises

from anthem.render import remotion_command  # unit under test
from anthem.verify import check_probe, verify_video  # unit under test

GOOD = {"streams": [{"codec_type": "video", "codec_name": "h264", "width": 1920, "height": 1080, "r_frame_rate": "30/1"},
                    {"codec_type": "audio", "codec_name": "aac"}], "format": {"duration": "240.40"}}  # what we expect


def test_remotion_command_full_and_preview(tmp_path):
    full = remotion_command(tmp_path / "a.mp4", concurrency=6, preview=False)  # final render
    assert full[1:5] == ["remotion", "render", "src/index.ts", "Anthem"]  # entry + composition id
    assert "--gl=angle" in full and "--concurrency=6" in full  # WebGL backend + parallel tabs
    assert not any(a.startswith("--scale") for a in full)  # full resolution
    prev = remotion_command(tmp_path / "p.mp4", concurrency=6, preview=True)  # quick check render
    assert "--scale=0.5" in prev and "--frames=0-899" in prev  # half size, first 30 s


def test_check_probe_accepts_expected_video():
    assert check_probe(GOOD, width=1920, height=1080, fps=30, duration_s=240.42) == []  # no problems


def test_check_probe_reports_each_problem():
    bad = json.loads(json.dumps(GOOD))  # deep copy
    bad["streams"][0]["width"] = 1280  # wrong size
    bad["streams"] = bad["streams"][:1]  # audio missing
    bad["format"]["duration"] = "200"  # too short
    problems = check_probe(bad, width=1920, height=1080, fps=30, duration_s=240.42)
    assert any("1280" in p for p in problems) and any("audio" in p for p in problems) and any("duration" in p for p in problems)


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_verify_video_on_tiny_real_mp4(tmp_path):
    mp4 = tmp_path / "tiny.mp4"  # 2 s, 320x180, 30 fps, h264 + aac
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=30:duration=2",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-shortest", str(mp4)], check=True)  # synthesize
    timeline = {"fps": 30, "durationS": 2.0, "sections": [{"label": "Intro", "scene": "intro", "startS": 0.0, "endS": 2.0}]}
    report = verify_video(mp4, timeline, tmp_path / "stills", width=320, height=180)  # run the real checks
    assert report["ok"], report["problems"]  # passes
    assert (tmp_path / "stills" / "verify_s01_intro.png").exists()  # midpoint still extracted


def test_keep_line_throttles_progress_only():
    from anthem.render import keep_line  # unit under test
    assert keep_line("Rendered 360/7200, time remaining: 4m") and keep_line("Rendered 7200/7200")  # 5% step + last
    assert not keep_line("Rendered 361/7200, time remaining: 4m")  # dropped
    assert keep_line("Warning: something odd") and not keep_line("   ")  # other lines kept, blanks dropped


def test_ansi_codes_are_stripped():
    from anthem.render import ANSI  # unit under test
    assert ANSI.sub("", "\x1b[90mCodec                h264\x1b[39m") == "Codec                h264"  # colors removed
