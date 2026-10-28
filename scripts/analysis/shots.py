"""Python mirror of the video's card lifecycle (video/src/stage/shots.ts) and panel layout (video/src/stage/layout.json).

Local: shots_at() and cards_on() reproduce shots.ts line for line; the timing constants are read from shots.ts and the
slot geometry from layout.json (plain JSON shared by TypeScript, Python and the tests), so the two cannot drift apart
silently. tests/test_integration.py runs the same cases as video/tests/shots.test.ts; tests/test_layout.py checks
the layout.
Global context: experiment 09 measures from timeline.json alone how long each figure is shown, how many panels are on
at once and whether any panel covers a scene's key objects.
Sources: smoothstep https://en.wikipedia.org/wiki/Smoothstep ; regular expressions https://docs.python.org/3/library/re.html
"""

import json  # layout.json
import re  # constants from shots.ts
from functools import cache  # read the layout once
from pathlib import Path  # source paths

SRC = Path(__file__).resolve().parents[2] / "video" / "src"  # the Remotion sources
C = {k: float(v) for k, v in re.findall(r"export const (\w+_S) = ([\d.]+);", (SRC / "stage" / "shots.ts").read_text(encoding="utf-8"))}  # EMERGE_S, DOCK_S
LANES = ["a", "b"]  # lane a -> slot 0, lane b -> slot 1 (shots.ts LANES)


@cache
def layout() -> dict:
    """Local: the parsed stage/layout.json.  Global: slots, protected regions and bands of every scene."""
    return json.loads((SRC / "stage" / "layout.json").read_text(encoding="utf-8"))


CARD_W, CARD_H = layout()["card"]["w"], layout()["card"]["h"]  # native card size a slot scales


def slot_rect(scene: str, lane: str):
    """Local: [x, y, w, h] of the slot a lane uses in a scene, or None.  Global: where a panel is drawn."""
    slots = layout()["scenes"].get(scene, layout()["scenes"]["default"])["slots"]
    i = LANES.index(lane) if lane in LANES else -1
    return slots[i] if 0 <= i < len(slots) else None


def rect_overlap(a, b) -> float:
    """Local: overlapping area of two [x, y, w, h] rectangles (0 if they only touch).  Global: exp09 H3."""
    w = min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0])
    h = min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1])
    return max(0, w) * max(0, h)


def ease(x: float) -> float:
    """Local: Hermite smoothstep on a clamped input (shots.ts `ease`).  Global: every eased step."""
    c = min(1.0, max(0.0, x))
    return c * c * (3 - 2 * c)


def shots_at(vignettes: list[dict], sections: list[dict], t: float) -> list[dict]:
    """Local: every panel visible at t with its emerge/dock numbers (shots.ts `shotsAt`).  Global: exp09 measures."""
    out = []
    for i, v in enumerate(vignettes):
        if v["lane"] == "scene":
            continue  # drawn by its scene
        section_end = next((s["endS"] for s in sections if s["index"] == v["sectionIndex"]), v["endS"])  # docks live until the cut
        if t < v["startS"] or t >= max(section_end, v["endS"] + C["DOCK_S"]):
            continue  # not yet, or gone with its section
        k = sum(1 for u in vignettes if u["sectionIndex"] == v["sectionIndex"] and u["lane"] != "scene" and u["startS"] < v["startS"])
        out.append({"v": v, "fig": i + 1, "k": k, "slot": LANES.index(v["lane"]),
                    "emerge": ease((t - v["startS"]) / C["EMERGE_S"]), "dock": ease((t - v["endS"]) / C["DOCK_S"])})
    return out


def cards_on(vignettes: list[dict], section_index: int, t: float) -> list[dict]:
    """Local: the section's "scene" cards on at t, with `on` easing in and out (shots.ts `cardsOn`).
    Global: how long scene-drawn figures are visible."""
    own = [v for v in vignettes if v["lane"] == "scene" and v["sectionIndex"] == section_index]
    return [{"v": v, "k": k, "on": ease((t - v["startS"]) / C["EMERGE_S"]) * (1 - ease((t - v["endS"]) / C["DOCK_S"]))}
            for k, v in enumerate(own) if v["startS"] <= t < v["endS"] + C["DOCK_S"]]
