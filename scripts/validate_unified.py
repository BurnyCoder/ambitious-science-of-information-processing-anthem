"""Experiment 09: figures that are part of the scenes (v1.5.0) — design checks, the intro gap and descriptive measures.

Local:
  - H1 dwell and H2 concurrency of the panel cards, from timeline.json;
  - H3 overlap of every panel slot with its scene's protected regions and lyric bands, from stage/layout.json;
  - H4 the 0:14 gap: PNG bytes of v1.5.0 vs v1.3.0 at 13, 14, ..., 18 s (median log2 ratio >= 0);
  - descriptive: seconds each figure is shown (v1.5.0) vs seconds it was the hero (v1.4.0, saved in
    reports/data/exp09_v140_baseline.json), and the share of time a figure covered a protected object.
H5 (detail non-inferiority vs v1.4.0, outro excluded) is run by validate_density.py with --until.
Global context: reports/exp09_unified.md pre-registers these checks. Writes reports/data/exp09_unified.json.
Usage: uv run python -I scripts/validate_unified.py [new.mp4] [v1.3.0.mp4]
"""

import json  # timeline, layout, results
import logging  # timestamped logs
import statistics  # medians
import sys  # paths + CLI
from pathlib import Path  # paths

import numpy as np  # paired log ratios

ROOT = Path(__file__).resolve().parents[1]  # repo root
sys.path[:0] = [str(ROOT / "src"), str(ROOT / "scripts")]  # pipeline package + experiment helpers
from anthem.logging_setup import log_json, setup_logging  # terminal + file logs
from analysis.shots import layout, rect_overlap, slot_rect  # stage geometry
from validate_density import png_bytes  # PNG size of one decoded frame

H4_TIMES = [13.0, 14.0, 15.0, 16.0, 17.0, 18.0]  # pre-specified: the 0:14 window, 1 s step
log = logging.getLogger("exp09")


def main() -> None:
    setup_logging(ROOT / "logs", prefix="exp09_unified")
    new = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "out" / "anthem.mp4"
    old = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "out" / "v1.3.0" / "we-will-know-anthem.mp4"
    tl = json.loads((ROOT / "video" / "public" / "timeline.json").read_text(encoding="utf-8"))
    ends = {s["index"]: s["endS"] for s in tl["sections"]}
    scene_of = {s["index"]: s["scene"] for s in tl["sections"]}
    panels = [c for c in tl["vignettes"] if c["lane"] != "scene"]
    shown = [c["endS"] - c["startS"] for c in panels]
    cut_limited = [abs(c["endS"] - ends[c["sectionIndex"]]) < 1e-6 and ends[c["sectionIndex"]] - c["startS"] < 3.0 for c in panels]
    h1 = all(s >= (2.5 if cl else 3.0 - 1 / 30) for s, cl in zip(shown, cut_limited))  # same rule as tests/test_vignettes.py
    conc = max(sum(o["startS"] <= c["startS"] < o["endS"] for o in panels if o["sectionIndex"] == c["sectionIndex"]) for c in panels)
    lay = layout()
    overlaps = [{"scene": name, "slot": i, "with": p, "area": rect_overlap(r, p)}
                for name, sc in lay["scenes"].items() for i, r in enumerate(sc["slots"])
                for p in sc["protect"] + [lay["bands"]["hud"], lay["bands"]["ticker"], lay["bands"][sc["band"]]] if rect_overlap(r, p) > 0]
    assert all(slot_rect(scene_of[c["sectionIndex"]], c["lane"]) for c in panels)  # every panel has a slot
    r4 = [float(np.log2(png_bytes(new, t) / png_bytes(old, t))) for t in H4_TIMES]
    base = json.loads((ROOT / "reports" / "data" / "exp09_v140_baseline.json").read_text(encoding="utf-8"))
    hero_v140 = [c["heroS"] for c in base["heroSecondsPerCard"]]
    cover = base["heroOverProtectedSecondsByScene"]
    all_shown = [c["endS"] - c["startS"] for c in tl["vignettes"]]
    result = {
        "cards": len(tl["vignettes"]), "panels": len(panels), "sceneDrawn": len(tl["vignettes"]) - len(panels),
        "H1": {"pass": h1, "minPanelSeconds": round(min(shown), 2), "cutLimited": sum(cut_limited), "medianPanelSeconds": round(statistics.median(shown), 2)},
        "H2": {"pass": conc <= 2, "maxPanelsAtOnce": conc},
        "H3": {"pass": not overlaps, "overlaps": overlaps},
        "H4": {"pass": statistics.median(r4) >= 0, "times": H4_TIMES, "log2RatioVsV130": [round(x, 3) for x in r4], "median": round(statistics.median(r4), 3)},
        "descriptive": {
            "v140HeroSeconds": {"median": round(statistics.median(hero_v140), 2), "under2s": sum(x < 2 for x in hero_v140), "cards": len(hero_v140)},
            "v150ShownSeconds": {"median": round(statistics.median(all_shown), 2), "under2s": sum(x < 2 for x in all_shown), "cards": len(all_shown),
                                 "panelUnder3s": sum(x < 3 for x in shown)},
            "v140HeroOverProtectedShare": round(sum(v["coveringS"] for v in cover.values()) / sum(v["heroS"] for v in cover.values()), 3),
            "v150PanelOverProtectedShare": 0.0 if not overlaps else None,  # slots never overlap protected regions (H3)
        },
    }
    (ROOT / "reports" / "data" / "exp09_unified.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    log_json(log, "exp09 unified", result)


if __name__ == "__main__":
    main()
