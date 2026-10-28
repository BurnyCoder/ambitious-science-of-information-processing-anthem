"""Experiment 10: centred intro, a living chorus, a voice-driven atlas and the grand finale (v1.6.0).

Local:
  - H1 centring: the horizontal centroid of bright pixels (luma > 160) in the title band at 9.3 s and in the token
    band at 4.0 s, decoded from the MP4 (v1.5.0 measured the same way for comparison);
  - H3 chorus detail: PNG bytes v1.6.0 vs v1.5.0 on the song's 2 s grid inside the two choruses, median log2 ratio
    with a frame-bootstrap 95 % CI (superiority);
  - H4 finale detail: the same on frames every 1 s from 230.5 to 239.5 s;
  - H5 elsewhere: every other frame of the 2 s grid before the overview, section-bootstrap CI of the median log2
    ratio, non-inferiority with margin 0.10 (as exp08/09);
  - descriptive: the vocal envelope and the sphere scale over the bridge (from vocal_energy.json).
H2 (theory windows) is a design check in tests/test_vignettes.py. Global context: reports/exp10_finale.md
pre-registers these checks. Writes reports/data/exp10_finale.json.
Sources: ffmpeg rawvideo gray frames https://ffmpeg.org/ffmpeg-formats.html#rawvideo ; Rec. 601 luma is what
ffmpeg's gray pixel format stores; bootstrap helpers in analysis/stats.py; PNG bytes in validate_density.py.
Usage: uv run python -I scripts/validate_finale.py [new.mp4] [v1.5.0.mp4]
"""

import json  # timeline + results
import logging  # timestamped logs
import subprocess  # ffmpeg
import sys  # paths + CLI
from pathlib import Path  # paths

import numpy as np  # pixels + ratios

ROOT = Path(__file__).resolve().parents[1]  # repo root
sys.path[:0] = [str(ROOT / "src"), str(ROOT / "scripts")]  # pipeline package + experiment helpers
from anthem.logging_setup import log_json, setup_logging  # terminal + file logs
from analysis.stats import cluster_median_ci, density_decision, median_ci  # tested bootstrap helpers + decision rule
from validate_density import STEP_S, png_bytes  # the 2 s grid and the PNG size of one decoded frame

W, H = 1920, 1080  # frame size
H1 = [("title", 9.3, (520, 700), 0.01), ("token", 4.0, (150, 520), 0.02)]  # (band, time, rows, tolerance as share of width)
H4_TIMES = np.arange(230.5, 239.6, 1.0)  # pre-specified finale frames
MARGIN = 0.10  # H5 non-inferiority margin (log2 units)
log = logging.getLogger("exp10")


def gray(video: Path, t: float) -> np.ndarray:
    """Local: the frame at t seconds as an (H, W) uint8 luma array.  Global: H1 centroids."""
    out = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1",
                          "-f", "rawvideo", "-pix_fmt", "gray", "-"], check=True, capture_output=True)
    return np.frombuffer(out.stdout, dtype=np.uint8).reshape(H, W)


def centroid_x(video: Path, t: float, rows: tuple[int, int]) -> float:
    """Local: mean x of the pixels brighter than 160 in rows [y0, y1).  Global: H1."""
    ys, xs = np.nonzero(gray(video, t)[rows[0]:rows[1]] > 160)
    return float(xs.mean()) if xs.size else float("nan")


def log2_ratios(new: Path, old: Path, times) -> np.ndarray:
    """Local: log2(PNG bytes new / old) at each time.  Global: H3-H5."""
    return np.array([np.log2(png_bytes(new, t) / png_bytes(old, t)) for t in times])


def main() -> None:
    setup_logging(ROOT / "logs", prefix="exp10_finale")
    new = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "out" / "anthem.mp4"
    old = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "out" / "v1.5.0" / "we-will-know-anthem.mp4"
    tl = json.loads((ROOT / "video" / "public" / "timeline.json").read_text(encoding="utf-8"))
    h1 = {}
    for band, t, rows, tol in H1:
        cx, cx_old = centroid_x(new, t, rows), centroid_x(old, t, rows)
        h1[band] = {"t": t, "rows": rows, "centroidX": round(cx, 1), "offsetPx": round(cx - W / 2, 1), "tolerancePx": tol * W,
                    "pass": abs(cx - W / 2) <= tol * W, "v150CentroidX": round(cx_old, 1)}
    times = np.arange(1.0, tl["durationS"] - 1.0, STEP_S)  # the exp07-09 grid
    starts = [s["startS"] for s in tl["sections"]]
    section = np.array([int(np.searchsorted(starts, t, side="right") - 1) for t in times])
    chorus = np.array([tl["sections"][k]["scene"] == "chorus" for k in section])
    overview = tl["downbeats"][max(i for i, d in enumerate(tl["downbeats"]) if d <= tl["lines"][-1]["endS"] - 0.6)]  # the rewind's landing
    r = log2_ratios(new, old, times)
    h3 = median_ci(r[chorus])
    rest = ~chorus & (times < overview)
    h5 = cluster_median_ci(r[rest], section[rest])
    r4 = log2_ratios(new, old, H4_TIMES)
    h4 = median_ci(r4)
    bridge = next(s for s in tl["sections"] if s["scene"] == "atlas")
    voice = json.loads((ROOT / "video" / "public" / "vignettes" / "vocal_energy.json").read_text(encoding="utf-8"))
    env = np.array(voice["energy"])[int(bridge["startS"] * voice["fps"]):int(bridge["endS"] * voice["fps"])]
    result = {
        "new": new.name, "old": old.name,
        "H1": {**h1, "pass": all(v["pass"] for v in h1.values())},
        "H3": {"frames": int(chorus.sum()), "median": h3[0], "ci95FrameBootstrap": h3[1:], "pass": density_decision(h3[0], h3[1:])},
        "H4": {"times": H4_TIMES.tolist(), "log2Ratio": [round(float(x), 3) for x in r4], "median": h4[0], "ci95FrameBootstrap": h4[1:],
               "pass": density_decision(h4[0], h4[1:])},
        "H5": {"frames": int(rest.sum()), "overviewStartS": overview, "median": h5[0], "ci95SectionBootstrap": h5[1:], "margin": MARGIN,
               "pass": density_decision(h5[0], h5[1:], MARGIN),
               "perSectionMedian": {f"{k + 1:02d} {tl['sections'][k]['label']}": round(float(np.median(r[rest & (section == k)])), 3)
                                    for k in sorted(set(section[rest].tolist()))}},
        "descriptive": {"bridgeVocalEnvelope": {"mean": round(float(env.mean()), 3), "p10": round(float(np.percentile(env, 10)), 3),
                                                "p90": round(float(np.percentile(env, 90)), 3)},
                        "vocalStemSha256": voice["sha256"]},
        "times": times.tolist(), "log2Ratio": [round(float(x), 4) for x in r], "section": section.tolist(),
    }
    (ROOT / "reports" / "data" / "exp10_finale.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    log_json(log, "exp10 results", {k: v for k, v in result.items() if k not in ("times", "log2Ratio", "section")})


if __name__ == "__main__":
    main()
