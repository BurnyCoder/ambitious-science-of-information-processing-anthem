"""Render phase: run the Remotion CLI and stream its output into the run log.

Local: builds the `npx remotion render` command (ANGLE GL backend for Three.js,
configurable concurrency, optional half-size 30-second preview) and runs it in video/,
forwarding every output line to the logger in real time.
Global context: consumes video/public/timeline.json + anthem.mp3 written by the timeline
phase and produces out/anthem.mp4 for the verify phase.
Sources:
- CLI flags (--gl, --concurrency, --scale, --frames): https://www.remotion.dev/docs/cli/render
- ANGLE for WebGL: https://www.remotion.dev/docs/three
- streaming subprocess output: https://docs.python.org/3/library/subprocess.html#subprocess.Popen
"""

import logging  # stream renderer output
import re  # recognize per-frame progress lines
import shutil  # locate npx (npx.cmd on Windows)
import subprocess  # run the CLI
from pathlib import Path  # paths

log = logging.getLogger(__name__)  # module logger
PROGRESS = re.compile(r"(Rendered|Encoded) (\d+)/(\d+)")  # e.g. "Rendered 755/7213, time remaining: 5m 12s"
ANSI = re.compile(r"\x1b\[[0-9;]*m")  # terminal color codes Remotion emits (e.g. ESC[90m), unreadable in log files


def keep_line(line: str) -> bool:
    """Local: drop per-frame progress except every 5% and the last frame.
    Global: keeps the run log readable (one render prints ~14k progress lines)."""
    m = PROGRESS.search(line)  # progress line?
    if not m:
        return bool(line.strip())  # keep every other non-empty line (warnings, errors, summaries)
    done, total = int(m[2]), int(m[3])  # frames done / total
    return done == total or done % max(1, total // 20) == 0  # 5% steps


def remotion_command(output: Path, concurrency: int, preview: bool) -> list[str]:
    """Local: argv for one render.  Global: preview renders 30 s at half size to check timing quickly."""
    npx = shutil.which("npx") or "npx"  # resolves npx.cmd on Windows so shell=False works
    cmd = [npx, "remotion", "render", "src/index.ts", "Anthem", str(output),  # entry point + composition id + output
           "--gl=angle", f"--concurrency={concurrency}", "--log=info"]  # WebGL backend, parallel tabs, progress lines
    if preview:
        cmd += ["--scale=0.5", "--frames=0-899"]  # 960x540, first 900 frames (30 s at 30 fps)
    return cmd


def render_video(video_dir: Path, out_dir: Path, concurrency: int = 8, preview: bool = False) -> Path:
    """Local: run the render, logging each line; raise on failure.  Global: the "render" phase."""
    out_dir.mkdir(parents=True, exist_ok=True)  # out/ is git-ignored
    output = (out_dir / ("anthem_preview.mp4" if preview else "anthem.mp4")).resolve()  # absolute: cwd is video/
    cmd = remotion_command(output, concurrency, preview)  # argv
    log.info("Rendering: %s (cwd=%s)", " ".join(cmd), video_dir)  # exact command for reproducibility
    proc = subprocess.Popen(cmd, cwd=video_dir, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, encoding="utf-8", errors="replace", bufsize=1)  # line-buffered text stream
    for line in proc.stdout:  # realtime: one log record per renderer line
        if keep_line(line):  # throttle per-frame progress
            log.info("[remotion] %s", ANSI.sub("", line).rstrip())  # plain text in the log
    if proc.wait() != 0:  # non-zero exit = failed render
        raise RuntimeError(f"Remotion render failed with exit code {proc.returncode}")
    log.info("Rendered %s (%.1f MB)", output, output.stat().st_size / 1e6)
    return output
