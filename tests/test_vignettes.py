"""Tests for anthem.vignettes (the illustration track of figure cards).

Local: a card lands just before its sung trigger word, generic section keys place one card per occurrence,
cards never outlive their section, cards sharing a slot never overlap, unplaceable cards fail loudly, and
coverage counts the sung lines that got a card. The last test checks the real content/vignettes.toml against
the real committed timeline.json.
Global context: the cards are the video's main density layer; these tests keep every card synced to a sung
word and every sung line illustrated (the pre-specified 100 % coverage target of reports/exp07).
"""

import json  # the committed real timeline
import tomllib  # banned words from content/song.toml
from pathlib import Path  # repo paths

import pytest  # approx + raises

from anthem.vignettes import VignetteError, load_vignettes, place_vignettes, vignette_coverage  # units under test

ROOT = Path(__file__).resolve().parents[1]  # repo root


def toy_timeline() -> dict:
    """Local: two choruses with words every 0.5 s.  Global: the shape build_timeline() writes, minus audio."""
    def words(texts, t0):  # timed words starting at t0
        return [{"text": w, "startS": t0 + 0.5 * i, "endS": t0 + 0.5 * i + 0.4, "backing": False} for i, w in enumerate(texts)]
    lines = [{"index": 0, "sectionIndex": 0, "backing": False, "words": words(["We", "will", "know!"], 10.0)},
             {"index": 1, "sectionIndex": 0, "backing": False, "words": words(["We", "will", "understand!"], 12.0)},
             {"index": 2, "sectionIndex": 1, "backing": False, "words": words(["We", "will", "know!"], 30.0)}]
    for line in lines:  # line span from its words, as in build_timeline()
        line["startS"], line["endS"] = line["words"][0]["startS"], line["words"][-1]["endS"]
    sections = [{"index": 0, "label": "Chorus", "kind": "chorus", "occurrence": 1, "startS": 9.9, "endS": 29.9},
                {"index": 1, "label": "Chorus", "kind": "chorus", "occurrence": 2, "startS": 29.9, "endS": 40.0}]
    return {"sections": sections, "lines": lines}


def spec(*cards: dict) -> dict:
    """Local: a loaded spec with default fields.  Global: what load_vignettes() returns."""
    base = {"title": "t", "badge": "schematic", "cite": "c", "hold": 6.0, "nth": 1, "text": "", "url": ""}
    return {"slots": {"lt": [0, 0, 1, 1]}, "vignettes": [{**base, **c} for c in cards]}


def test_card_lands_just_before_its_trigger_word():
    cards = place_vignettes(spec({"id": "a", "section": "chorus 1", "trigger": "^understand", "slot": "lt"}), toy_timeline())
    assert len(cards) == 1 and cards[0]["startS"] == pytest.approx(13.0 - 0.15)  # "understand!" is sung at 13.0 s
    assert cards[0]["endS"] == pytest.approx(13.0 - 0.15 + 6.0)  # shown for `hold` seconds
    assert cards[0]["lineIndex"] == 1 and cards[0]["sectionIndex"] == 0  # remembers what it illustrates


def test_generic_section_key_places_one_card_per_occurrence():
    cards = place_vignettes(spec({"id": "k", "section": "chorus", "trigger": "^know$", "slot": "lt"}), toy_timeline())
    assert [c["sectionIndex"] for c in cards] == [0, 1]  # "chorus" addresses both choruses, like scenes.toml


def test_card_never_outlives_its_section():
    cards = place_vignettes(spec({"id": "k", "section": "chorus 1", "trigger": "know", "slot": "lt", "hold": 60}), toy_timeline())
    assert cards[0]["endS"] == pytest.approx(29.9)  # clipped at the cut to the next scene
    late = toy_timeline()
    late["sections"][0]["endS"] = 13.5  # cut 0.5 s after "understand!" (13.0 s)
    card = place_vignettes(spec({"id": "u", "section": "chorus 1", "trigger": "understand", "slot": "lt"}), late)[0]
    assert card["endS"] - card["startS"] == pytest.approx(2.0)  # spills past the cut so it can still be read


def test_nth_match_and_same_slot_trimming():
    s = spec({"id": "a", "section": "chorus 1", "trigger": "^we$", "slot": "lt"},
             {"id": "b", "section": "chorus 1", "trigger": "^we$", "nth": 2, "slot": "lt"})
    a, b = place_vignettes(s, toy_timeline())
    assert b["startS"] == pytest.approx(12.0 - 0.15)  # second "We" of the section
    assert a["endS"] == pytest.approx(b["startS"])  # earlier card trimmed: one card per slot at a time


def test_unplaceable_cards_raise():
    with pytest.raises(VignetteError, match="never sung"):  # trigger word not in that section
        place_vignettes(spec({"id": "x", "section": "chorus 1", "trigger": "^banana$", "slot": "lt"}), toy_timeline())
    with pytest.raises(VignetteError, match="no section"):  # section key matches nothing
        place_vignettes(spec({"id": "x", "section": "verse 9", "trigger": "we", "slot": "lt"}), toy_timeline())


def test_coverage_counts_lines_with_a_card():
    tl = toy_timeline()
    tl["vignettes"] = place_vignettes(spec({"id": "k", "section": "chorus", "trigger": "^know$", "slot": "lt"}), tl)
    assert vignette_coverage(tl) == pytest.approx(2 / 3, abs=1e-4)  # lines 0 and 2 got a card, line 1 did not


def test_load_vignettes_validates(tmp_path):
    p = tmp_path / "v.toml"
    p.write_text('[slots]\nlt = [0, 0, 10, 10]\n\n[[vignette]]\nid = "a"\nsection = "chorus"\ntrigger = "we"\n'
                 'slot = "zz"\ntitle = "t"\nbadge = "schematic"\ncite = "c"\n', encoding="utf-8")
    with pytest.raises(VignetteError, match="slot"):  # unknown slot name
        load_vignettes(p)
    p.write_text(p.read_text(encoding="utf-8").replace('"zz"', '"lt"').replace('"t"', '"a theory of Mind"'), encoding="utf-8")
    with pytest.raises(VignetteError, match="mind"):  # banned words are refused on screen too
        load_vignettes(p, banned=["mind"])
    card = load_vignettes(p)["vignettes"][0]  # without a banned list it loads
    p.write_text(p.read_text(encoding="utf-8") + "nth = 0\n", encoding="utf-8")
    with pytest.raises(VignetteError, match="nth"):  # 0 would silently pick the last match
        load_vignettes(p)
    assert card["hold"] == 6.0 and card["nth"] == 1 and card["text"] == ""  # defaults filled in


def test_real_cards_cover_every_sung_line_of_the_real_timeline():
    banned = tomllib.loads((ROOT / "content" / "song.toml").read_text(encoding="utf-8"))["banned_words"]
    s = load_vignettes(ROOT / "content" / "vignettes.toml", banned=banned)  # the real catalog
    tl = json.loads((ROOT / "video" / "public" / "timeline.json").read_text(encoding="utf-8"))  # real word times
    tl["vignettes"] = place_vignettes(s, tl)  # raises if any trigger is not sung where it is placed
    assert vignette_coverage(tl) == 1.0  # pre-specified target: every sung non-backing line is illustrated
    assert min(c["endS"] - c["startS"] for c in tl["vignettes"]) >= 1.0  # every card stays readable for >= 1 s
