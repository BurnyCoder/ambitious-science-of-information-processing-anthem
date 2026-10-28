"""Experiment 08, integration: how the figure cards share the frame with the general scenes in v1.4.0.

Local: walks the whole song at 30 fps and, with the Python mirror of the shot lifecycle (analysis/shots.py), measures:
  - how much of the sung time (and of the whole song) a figure is centre stage (max heroness >= 0.5);
  - how much of the time the general scene has the frame to itself (no hero);
  - the nominal frame share a hero covers, weighted by heroness, and its maximum (balance rule: <= 0.6);
  - the longest time any one card stays hero (design: <= HERO_MAX_S plus half an ease);
  - the most cards active at once, between their start and end (design: <= 4 lanes), and the most in flight
    including cards still flying back to dock (descriptive);
  - how many cards per section dock into a scene object (rung, pillar, star, node, halo, token).
Global context: the descriptive half of exp08 (reports/exp08_integration.md); the other half is the density
non-inferiority test in validate_density.py. Reads only timeline.json, so it needs no render.
Writes reports/data/exp08_integration.json.
Usage: uv run python -I scripts/validate_integration.py
"""

import json  # timeline + results
import logging  # timestamped logs
import sys  # import path
from collections import Counter  # docks per section
from pathlib import Path  # paths

ROOT = Path(__file__).resolve().parents[1]  # repo root
sys.path[:0] = [str(ROOT / "src"), str(ROOT / "scripts")]  # pipeline package + experiment helpers
from anthem.logging_setup import log_json, setup_logging  # terminal + file logs
from analysis.shots import C, PAST_SCENES, hero_area_fraction, heroness, shots_at  # mirrored lifecycle

FPS = 30  # the video's frame rate: one sample per frame
HERO_ON = 0.5  # pre-specified: a card "is the hero" when its heroness is at least 0.5
log = logging.getLogger("exp08")


def main() -> None:
    setup_logging(ROOT / "logs", prefix="exp08_integration")
    tl = json.loads((ROOT / "video" / "public" / "timeline.json").read_text(encoding="utf-8"))
    cards, sections = tl["vignettes"], tl["sections"]
    scene_of = {s["index"]: s["scene"] for s in sections}
    lines = [(l["startS"], l["endS"]) for l in tl["lines"]]
    frames = [i / FPS for i in range(int(tl["durationS"] * FPS))]
    sung, hero_on, coverage, active, flying, hs = [], [], [], [], [], []
    hero_time: Counter = Counter()  # seconds each card spends as hero
    for t in frames:
        shots = shots_at(cards, sections, t)
        best = max(shots, key=heroness, default=None)
        h = heroness(best) if best else 0.0
        sung.append(any(a <= t < b for a, b in lines))
        hero_on.append(h >= HERO_ON)
        hs.append(h)
        coverage.append(h * hero_area_fraction(scene_of[best["v"]["sectionIndex"]]) if best else 0.0)
        active.append(sum(1 for s in shots if t < s["v"]["endS"]))  # emerging, hero or orbiting (the lane cap)
        flying.append(sum(1 for s in shots if s["dock"] < 1))  # plus cards still flying back to their object
        if best and h >= HERO_ON:
            hero_time[best["fig"]] += 1 / FPS
    n_sung = sum(sung)
    docks = Counter(c["sectionIndex"] for c in cards if scene_of[c["sectionIndex"]] not in PAST_SCENES)
    result = {
        "frames": len(frames), "sungFrames": n_sung, "heroOn": HERO_ON, "constants": C,
        "heroShareOfSungTime": round(sum(h for h, s in zip(hero_on, sung) if s) / n_sung, 3),
        "heroShareOfSong": round(sum(hero_on) / len(frames), 3),
        "sceneOnlyShareOfSong": round(1 - sum(hero_on) / len(frames), 3),  # the general scene has the frame alone
        "meanHeroCoverageSung": round(sum(c for c, s in zip(coverage, sung) if s) / n_sung, 3),
        "maxHeroAreaFraction": round(max(hero_area_fraction(s["scene"]) for s in sections), 3),
        "maxHeroSecondsPerCard": round(max(hero_time.values()), 2),
        "maxCardsActive": max(active), "maxCardsInFlight": max(flying),
        "cardsDockedPerSection": {f"{k + 1:02d} {scene_of[k]}": docks.get(k, 0) for k in scene_of},
        "cardsFlyingPast": sum(1 for c in cards if scene_of[c["sectionIndex"]] in PAST_SCENES),
        "seriesStepS": 0.1, "heroSeries": [round(h, 3) for h in hs[::3]],  # max heroness at 10 Hz (for the figure)
        "sectionStarts": [s["startS"] for s in sections], "sectionScenes": [s["scene"] for s in sections],
    }
    result["designChecks"] = {"heroAreaAtMost0.6": result["maxHeroAreaFraction"] <= 0.6,
                              "heroAtMostHeroMaxPlusHalfEase": result["maxHeroSecondsPerCard"] <= C["HERO_MAX_S"] + C["EASE_S"] / 2 + 1 / FPS,
                              "atMost4CardsActive": result["maxCardsActive"] <= 4}
    (ROOT / "reports" / "data" / "exp08_integration.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    log_json(log, "exp08 integration", {k: v for k, v in result.items() if k != "heroSeries"})


if __name__ == "__main__":
    main()
