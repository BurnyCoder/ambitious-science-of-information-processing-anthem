"""Experiment 07, visual density: are v1.3.0 frames more detailed than v1.2.0 frames at the same moments?

Local: decodes one frame every 2 s from both MP4s with ffmpeg, PNG-encodes each frame and records its size in
bytes (lossless-compressed size is a standard proxy for visual complexity), then summarizes the paired
log2(size v1.3.0 / size v1.2.0): median with a 95 % CI that resamples whole song sections (frames within a
section are autocorrelated), plus a per-frame CI as a secondary view.
Global context: the pre-specified "more detailed" check of reports/exp07_provenance.md; it measures detail,
not quality or legibility. Writes reports/data/exp07_density.json.
Sources: compression-based measures as predictors of rated visual complexity, Machado et al. 2015, "Computerized
measures of visual complexity", Acta Psychologica 160:43-57, https://doi.org/10.1016/j.actpsy.2015.06.005 ;
ffmpeg image2pipe https://ffmpeg.org/ffmpeg-formats.html#image2pipe ; bootstrap helpers in analysis/stats.py.
Usage: uv run python -I scripts/validate_density.py [old.mp4] [new.mp4]
"""

import json  # timeline + results
import logging  # timestamped logs
import subprocess  # ffmpeg
import sys  # paths + CLI
from pathlib import Path  # paths

import numpy as np  # ratios

ROOT = Path(__file__).resolve().parents[1]  # repo root
sys.path[:0] = [str(ROOT / "src"), str(ROOT / "scripts")]  # pipeline package + experiment helpers
from anthem.logging_setup import log_json, setup_logging  # terminal + file logs
from analysis.stats import cluster_median_ci, excludes_zero, median_ci  # tested bootstrap helpers

STEP_S = 2.0  # pre-specified sampling interval
log = logging.getLogger("exp07")  # stable logger name


def png_bytes(video: Path, t: float) -> int:
    """Local: size of the PNG encoding of the frame at t seconds.  Global: one complexity sample."""
    out = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1",
                          "-f", "image2pipe", "-vcodec", "png", "-"], check=True, capture_output=True)  # decoded frame -> PNG
    return len(out.stdout)


def main() -> None:
    setup_logging(ROOT / "logs", prefix="exp07_density")
    old = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "out" / "v1.2.0" / "we-will-know-anthem.mp4"
    new = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "out" / "anthem.mp4"
    tl = json.loads((ROOT / "video" / "public" / "timeline.json").read_text(encoding="utf-8"))
    times = np.arange(1.0, tl["durationS"] - 1.0, STEP_S)  # same timestamps in both videos
    starts = [s["startS"] for s in tl["sections"]]
    section = [int(np.searchsorted(starts, t, side="right") - 1) for t in times]  # cluster of each frame
    a = np.array([png_bytes(old, t) for t in times], dtype=float)
    b = np.array([png_bytes(new, t) for t in times], dtype=float)
    r = np.log2(b / a)  # > 0 = new frame compresses to more bytes = more detail
    primary = cluster_median_ci(r, section, n_resamples=10_000, seed=0)  # sections resampled
    secondary = median_ci(r, n_resamples=5000, seed=0)  # frames resampled
    per_section = {tl["sections"][k]["label"] + f" ({tl['sections'][k]['scene']})": round(float(np.median(r[np.array(section) == k])), 3)
                   for k in sorted(set(section))}
    result = {"old": str(old.name), "new": str(new.name), "frames": len(times), "stepS": STEP_S,
              "medianBytesOld": float(np.median(a)), "medianBytesNew": float(np.median(b)),
              "medianLog2Ratio": primary[0], "ci95SectionBootstrap": primary[1:], "ci95FrameBootstrap": secondary[1:],
              "framesNewLarger": int((r > 0).sum()), "perSectionMedianLog2Ratio": per_section,
              "pre_specified": "median log2 ratio > 0 with the section-bootstrap 95 % CI excluding 0",
              "pass": bool(primary[0] > 0 and excludes_zero(primary[1:])),
              "times": times.tolist(), "bytesOld": a.tolist(), "bytesNew": b.tolist(), "section": section}
    (ROOT / "reports" / "data" / "exp07_density.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    log_json(log, "exp07 visual density", {k: v for k, v in result.items() if k not in ("times", "bytesOld", "bytesNew", "section")})


if __name__ == "__main__":
    main()
