"""Visual density of two renders at the same moments (experiments 07 and 08).

Local: decodes one frame every 2 s from both MP4s with ffmpeg, PNG-encodes each frame and records its size in
bytes (lossless-compressed size is a standard proxy for visual complexity), then summarizes the paired
log2(size v1.3.0 / size v1.2.0): median with a 95 % CI that resamples whole song sections (frames within a
section are autocorrelated), plus a per-frame CI as a secondary view.
Global context: exp07 (v1.3.0 vs v1.2.0) pre-specified "more detailed": superiority, the CI excludes 0.
exp08 (v1.4.0 vs v1.3.0) pre-specified "not less detailed": non-inferiority, the CI's lower bound > −margin.
It measures detail, not quality or legibility. Writes reports/data/<name>.json.
Sources: compression-based measures as predictors of rated visual complexity, Machado et al. 2015, "Computerized
measures of visual complexity", Acta Psychologica 160:43-57, https://doi.org/10.1016/j.actpsy.2015.06.005 ;
ffmpeg image2pipe https://ffmpeg.org/ffmpeg-formats.html#image2pipe ; bootstrap helpers in analysis/stats.py.
Usage: uv run python -I scripts/validate_density.py [old.mp4] [new.mp4] [--name exp07_density] [--margin M] [--until S]
       exp08: uv run python -I scripts/validate_density.py out/v1.3.0/we-will-know-anthem.mp4 out/anthem.mp4 --name exp08_density --margin 0.10
"""

import argparse  # CLI
import json  # timeline + results
import logging  # timestamped logs
import subprocess  # ffmpeg
import sys  # paths + CLI
from pathlib import Path  # paths

import numpy as np  # ratios

ROOT = Path(__file__).resolve().parents[1]  # repo root
sys.path[:0] = [str(ROOT / "src"), str(ROOT / "scripts")]  # pipeline package + experiment helpers
from anthem.logging_setup import log_json, setup_logging  # terminal + file logs
from analysis.stats import cluster_median_ci, density_decision, median_ci  # tested bootstrap helpers + decision rule

STEP_S = 2.0  # pre-specified sampling interval


def png_bytes(video: Path, t: float) -> int:
    """Local: size of the PNG encoding of the frame at t seconds.  Global: one complexity sample."""
    out = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1",
                          "-f", "image2pipe", "-vcodec", "png", "-"], check=True, capture_output=True)  # decoded frame -> PNG
    return len(out.stdout)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("old", nargs="?", type=Path, default=ROOT / "out" / "v1.2.0" / "we-will-know-anthem.mp4")
    ap.add_argument("new", nargs="?", type=Path, default=ROOT / "out" / "anthem.mp4")
    ap.add_argument("--name", default="exp07_density", help="output reports/data/<name>.json and log prefix")
    ap.add_argument("--margin", type=float, default=None, help="non-inferiority margin in log2 units (default: superiority test)")
    ap.add_argument("--until", type=float, default=None, help="only frames before this time (exp09 excludes the rewound outro)")
    args = ap.parse_args()
    setup_logging(ROOT / "logs", prefix=args.name)
    log = logging.getLogger(args.name.split("_")[0])  # exp07 / exp08
    old, new = args.old, args.new
    tl = json.loads((ROOT / "video" / "public" / "timeline.json").read_text(encoding="utf-8"))
    times = np.arange(1.0, min(args.until or 1e9, tl["durationS"] - 1.0), STEP_S)  # same timestamps in both videos
    starts = [s["startS"] for s in tl["sections"]]
    section = [int(np.searchsorted(starts, t, side="right") - 1) for t in times]  # cluster of each frame
    a = np.array([png_bytes(old, t) for t in times], dtype=float)
    b = np.array([png_bytes(new, t) for t in times], dtype=float)
    r = np.log2(b / a)  # > 0 = new frame compresses to more bytes = more detail
    primary = cluster_median_ci(r, section, n_resamples=10_000, seed=0)  # sections resampled
    secondary = median_ci(r, n_resamples=5000, seed=0)  # frames resampled
    per_section = {f"{k + 1:02d} {tl['sections'][k]['label']} ({tl['sections'][k]['scene']})": round(float(np.median(r[np.array(section) == k])), 3)  # numbered: repeated labels stay distinct
                   for k in sorted(set(section))}
    result = {"old": str(old.name), "new": str(new.name), "frames": len(times), "stepS": STEP_S, "untilS": args.until,
              "medianBytesOld": float(np.median(a)), "medianBytesNew": float(np.median(b)),
              "medianLog2Ratio": primary[0], "ci95SectionBootstrap": primary[1:], "ci95FrameBootstrap": secondary[1:],
              "framesNewLarger": int((r > 0).sum()), "perSectionMedianLog2Ratio": per_section,
              "pre_specified": ("median log2 ratio > 0 with the section-bootstrap 95 % CI excluding 0" if args.margin is None
                                else f"section-bootstrap 95 % CI lower bound of the median log2 ratio > -{args.margin}"),
              "pass": density_decision(primary[0], primary[1:], args.margin),
              "times": times.tolist(), "bytesOld": a.tolist(), "bytesNew": b.tolist(), "section": section}
    (ROOT / "reports" / "data" / f"{args.name}.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    log_json(log, f"{args.name} visual density", {k: v for k, v in result.items() if k not in ("times", "bytesOld", "bytesNew", "section")})


if __name__ == "__main__":
    main()
