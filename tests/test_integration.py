"""Tests for scripts/analysis/shots.py, the Python mirror of video/src/stage/shots.ts (experiment 09).

Local: the same three cases as video/tests/shots.test.ts (a panel stays in its slot for its whole time, a newer card
never pushes an older one out, scene cards are left to their scene), plus the constants read from the TypeScript.
Global context: exp09's measures come from this mirror, so it must behave exactly like the video.
"""

from analysis.shots import C, cards_on, shots_at  # units under test

SECTIONS = [{"index": 0, "scene": "ladder", "startS": 0, "endS": 20}]


def card(id_: str, start: float, end: float, lane: str = "a", section: int = 0) -> dict:
    """Local: a minimal placed card.  Global: test input shaped like timeline.json vignettes."""
    return {"id": id_, "lane": lane, "sectionIndex": section, "startS": start, "endS": end}


def test_constants_come_from_the_typescript():
    assert C == {"EMERGE_S": 0.4, "DOCK_S": 0.5}


def test_a_panel_stays_in_its_slot_then_docks():
    v = [card("a", 1, 7)]
    assert shots_at(v, SECTIONS, 0.5) == []  # before its start
    e = shots_at(v, SECTIONS, 1.2)[0]
    assert 0 < e["emerge"] < 1 and e["dock"] == 0  # flying out of its object
    assert all((shots_at(v, SECTIONS, t)[0]["emerge"], shots_at(v, SECTIONS, t)[0]["dock"]) == (1, 0) for t in (2, 4, 6.9))
    assert shots_at(v, SECTIONS, 8)[0]["dock"] == 1  # docked after its end
    assert shots_at(v, SECTIONS, 20) == []  # gone with its section


def test_newer_card_never_pushes_and_scene_cards_are_separate():
    s = shots_at([card("old", 1, 9, "a"), card("new", 2, 9, "b")], SECTIONS, 3)
    assert [(x["v"]["id"], x["slot"], x["emerge"], x["dock"]) for x in s] == [("old", 0, 1, 0), ("new", 1, 1, 0)]
    assert s[1]["k"] == 1  # second card of its section
    v = [card("chip", 1, 5, "scene"), card("p", 1, 5, "a")]
    assert [x["v"]["id"] for x in shots_at(v, SECTIONS, 2)] == ["p"]
    assert [(x["v"]["id"], x["k"], x["on"]) for x in cards_on(v, 0, 2)] == [("chip", 0, 1)]
    assert 0 < cards_on(v, 0, 5.2)[0]["on"] < 1 and cards_on(v, 0, 5.6) == []  # fades over DOCK_S
    assert cards_on(v, 1, 2) == []
