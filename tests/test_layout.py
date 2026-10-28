"""Tests for video/src/stage/layout.json: where each scene puts its figure panels (experiment 09, H3).

Local: every panel slot lies inside the 1920x1080 frame, is big enough to read (scale >= 0.9 of the 600 x 350 card),
does not overlap the other slot, the scene's protected regions (its key objects) or the shared bands (HUD, ticker,
and the karaoke or giant-word band), and every panel card in timeline.json has a slot in its scene.
Global context: the stage (video/src/stage/) draws panels only into these slots, so this file is what keeps the
figures from covering the ladder, the SGD swarm, the closing statement and the lyrics.
"""

import json  # layout + timeline
import tomllib  # scene map
from pathlib import Path  # repo paths

from analysis.shots import CARD_H, CARD_W, layout, rect_overlap, slot_rect  # units under test

ROOT = Path(__file__).resolve().parents[1]  # repo root
FRAME = (0, 0, 1920, 1080)  # x, y, w, h


def inside(r, outer=FRAME) -> bool:
    """Local: rectangle r lies within `outer`.  Global: slots must be fully on screen."""
    return r[0] >= outer[0] and r[1] >= outer[1] and r[0] + r[2] <= outer[0] + outer[2] and r[1] + r[3] <= outer[1] + outer[3]


def test_every_scene_has_a_layout_and_slots_are_clear():
    lay = layout()
    scenes = set(tomllib.loads((ROOT / "content" / "scenes.toml").read_text(encoding="utf-8"))["scenes"].values())
    assert scenes <= set(lay["scenes"]), scenes - set(lay["scenes"])  # every mapped scene is laid out
    for name, sc in lay["scenes"].items():
        bands = [lay["bands"]["hud"], lay["bands"]["ticker"], lay["bands"][sc["band"]]]  # shared rows this scene shows
        for i, r in enumerate(sc["slots"]):
            assert inside(r), (name, i)
            assert min(r[2] / CARD_W, r[3] / CARD_H) >= 0.9, (name, i)  # readable: at least 0.9 of the native card
            for other in sc["slots"][i + 1:]:
                assert rect_overlap(r, other) == 0, (name, "slots overlap")
            for p in sc["protect"] + bands:
                assert rect_overlap(r, p) == 0, (name, i, p)  # exp09 H3: never over a key object or a band


def test_rect_overlap_and_slot_lookup():
    assert rect_overlap((0, 0, 10, 10), (5, 5, 10, 10)) == 25  # 5 x 5 corner
    assert rect_overlap((0, 0, 10, 10), (10, 0, 5, 5)) == 0  # touching edges do not overlap
    assert slot_rect("ladder", "a") == layout()["scenes"]["ladder"]["slots"][0]  # lane a = slot 0, lane b = slot 1


def test_every_panel_card_has_a_slot_in_its_scene():
    tl = json.loads((ROOT / "video" / "public" / "timeline.json").read_text(encoding="utf-8"))
    scene_of = {s["index"]: s["scene"] for s in tl["sections"]}
    for c in tl["vignettes"]:
        if c["lane"] != "scene":
            assert slot_rect(scene_of[c["sectionIndex"]], c["lane"]) is not None, (c["id"], scene_of[c["sectionIndex"]], c["lane"])
