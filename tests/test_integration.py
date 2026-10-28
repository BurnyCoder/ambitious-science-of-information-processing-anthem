"""Tests for scripts/analysis/shots.py, the Python mirror of video/src/stage/shots.ts (experiment 08).

Local: the same three cases as video/tests/shots.test.ts (one card's lifecycle, a newer card taking over, sections
not interfering), plus checks that the constants and scene sets were read from the TypeScript sources.
Global context: exp08's integration numbers come from this mirror, so it must behave exactly like the video.
"""

from analysis.shots import BIG_SCENES, C, HERO_SCALE, PAST_SCENES, hero_area_fraction, heroness, shots_at  # units under test

SECTIONS = [{"index": 0, "scene": "layers", "startS": 0, "endS": 20}]


def card(id_: str, start: float, end: float, section: int = 0) -> dict:
    """Local: a minimal placed card.  Global: test input shaped like timeline.json vignettes."""
    return {"id": id_, "sectionIndex": section, "startS": start, "endS": end}


def test_constants_and_scene_sets_come_from_the_typescript():
    assert C == {"EMERGE_S": 0.4, "HERO_MAX_S": 3.2, "EASE_S": 0.4, "DOCK_S": 0.5}
    assert HERO_SCALE == {"HERO": 1.8, "HERO_BIG": 1.38}
    assert PAST_SCENES == {"intro", "layers", "landscape"}  # fly-through scenes: cards fly past the camera
    assert BIG_SCENES == {"chorus", "finale"}  # giant lyrics in the lower third
    assert hero_area_fraction("chorus") < hero_area_fraction("layers") < 0.6  # balance rule


def test_one_card_lifecycle():
    v = [card("a", 1, 7)]
    assert shots_at(v, SECTIONS, 0.5) == []  # before its start
    e = shots_at(v, SECTIONS, 1.2)[0]
    assert 0 < e["emerge"] < 1 and e["rank"] == 0  # flying out of its object
    assert heroness(shots_at(v, SECTIONS, 3)[0]) == 1  # full hero
    assert shots_at(v, SECTIONS, 5)[0]["rank"] >= 1  # hero time over: receded
    assert shots_at(v, SECTIONS, 8)[0]["dock"] == 1  # docked after its end
    assert shots_at(v, SECTIONS, 20) == []  # gone with its section


def test_newer_card_takes_over_and_sections_are_independent():
    v = [card("old", 1, 9), card("new", 2, 9)]
    s = shots_at(v, SECTIONS, 2.6)
    assert max(s, key=heroness)["v"]["id"] == "new"
    assert next(x for x in s if x["v"]["id"] == "old")["rank"] >= 1
    assert next(x for x in s if x["v"]["id"] == "new")["k"] == 1  # second card of its section
    two = SECTIONS + [{**SECTIONS[0], "index": 1}]
    assert shots_at([card("a", 1, 7, 0), card("b", 1.5, 7, 1)], two, 2)[0]["rank"] == 0
