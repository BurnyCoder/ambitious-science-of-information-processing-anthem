"""Tests for anthem.vignettes (the illustration track of figure cards).

Local: a card lands just before its sung trigger word, generic section keys place one card per occurrence,
cards never outlive their section, cards sharing a lane never overlap, unplaceable cards fail loudly, and
coverage counts the sung lines that got a card. The last test checks the real content/vignettes.toml against
the real committed timeline.json.
Global context: the cards are the video's main density layer; these tests keep every card synced to a sung
word and every sung line illustrated (the pre-specified 100 % coverage target of reports/exp07).
"""

import json  # the committed real timeline
import tomllib  # banned words from content/song.toml
from pathlib import Path  # repo paths

import pytest  # approx + raises

from anthem.vignettes import CLEAR_LEAD_S, VignetteError, load_vignettes, place_vignettes, vignette_coverage  # units under test

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
    return {"lanes": ["a"], "vignettes": [{**base, **c} for c in cards], "clears": []}


def test_card_lands_just_before_its_trigger_word():
    cards = place_vignettes(spec({"id": "a", "section": "chorus 1", "trigger": "^understand", "lane": "a"}), toy_timeline())
    assert len(cards) == 1 and cards[0]["startS"] == pytest.approx(13.0 - 0.15)  # "understand!" is sung at 13.0 s
    assert cards[0]["endS"] == pytest.approx(13.0 - 0.15 + 6.0)  # shown for `hold` seconds
    assert cards[0]["lineIndex"] == 1 and cards[0]["sectionIndex"] == 0  # remembers what it illustrates


def test_generic_section_key_places_one_card_per_occurrence():
    cards = place_vignettes(spec({"id": "k", "section": "chorus", "trigger": "^know$", "lane": "a"}), toy_timeline())
    assert [c["sectionIndex"] for c in cards] == [0, 1]  # "chorus" addresses both choruses, like scenes.toml


def test_card_never_outlives_its_section():
    cards = place_vignettes(spec({"id": "k", "section": "chorus 1", "trigger": "know", "lane": "a", "hold": 60}), toy_timeline())
    assert cards[0]["endS"] == pytest.approx(29.9)  # clipped at the cut to the next scene
    late = toy_timeline()
    late["sections"][0]["endS"] = 13.5  # cut 0.5 s after "understand!" (13.0 s)
    card = place_vignettes(spec({"id": "u", "section": "chorus 1", "trigger": "understand", "lane": "a"}), late)[0]
    assert card["endS"] == pytest.approx(13.5)  # no spill: a panel never hangs over the next scene


def test_nth_match_and_same_lane_trimming():
    s = spec({"id": "a", "section": "chorus 1", "trigger": "^we$", "lane": "a"},
             {"id": "b", "section": "chorus 1", "trigger": "^we$", "nth": 2, "lane": "a"})
    a, b = place_vignettes(s, toy_timeline())
    assert b["startS"] == pytest.approx(12.0 - 0.15)  # second "We" of the section
    assert a["endS"] == pytest.approx(b["startS"])  # earlier card trimmed: one card per lane at a time


def test_scene_lane_cards_are_never_trimmed():
    s = spec({"id": "a", "section": "chorus 1", "trigger": "^we$", "lane": "scene"},
             {"id": "b", "section": "chorus 1", "trigger": "^we$", "nth": 2, "lane": "scene"},
             {"id": "c", "section": "chorus 1", "trigger": "^will$", "lane": "a"})
    a, c, b = place_vignettes(s, toy_timeline())  # sorted by start: a (9.9, clamped to the cut), c (10.35), b (11.85)
    assert a["endS"] == pytest.approx(9.9 + 6.0)  # the scene draws it; a later scene card does not cut it short
    assert a["lane"] == b["lane"] == "scene" and c["lane"] == "a"


def test_clear_ends_earlier_cards_before_the_cue_word():
    s = spec({"id": "a", "section": "chorus 1", "trigger": "^we$", "lane": "a"},
             {"id": "z", "section": "chorus 1", "trigger": "^understand", "lane": "scene"})
    s["clears"] = [{"section": "chorus 1", "trigger": "^understand", "nth": 1}]
    a, z = place_vignettes(s, toy_timeline())
    assert a["endS"] == pytest.approx(13.0 - CLEAR_LEAD_S)  # gone (docked) by the time the cue word is sung
    assert z["endS"] == pytest.approx(13.0 - 0.15 + 6.0)  # the card on the cue itself is not cleared
    with pytest.raises(VignetteError, match="clear"):  # a clear cue that is never sung is a typo
        place_vignettes({**s, "clears": [{"section": "chorus 1", "trigger": "^banana$", "nth": 1}]}, toy_timeline())


def test_unplaceable_cards_raise():
    with pytest.raises(VignetteError, match="never sung"):  # trigger word not in that section
        place_vignettes(spec({"id": "x", "section": "chorus 1", "trigger": "^banana$", "lane": "a"}), toy_timeline())
    with pytest.raises(VignetteError, match="no section"):  # section key matches nothing
        place_vignettes(spec({"id": "x", "section": "verse 9", "trigger": "we", "lane": "a"}), toy_timeline())


def test_coverage_counts_lines_with_a_card():
    tl = toy_timeline()
    tl["vignettes"] = place_vignettes(spec({"id": "k", "section": "chorus", "trigger": "^know$", "lane": "a"}), tl)
    assert vignette_coverage(tl) == pytest.approx(2 / 3, abs=1e-4)  # lines 0 and 2 got a card, line 1 did not


def test_load_vignettes_validates(tmp_path):
    p = tmp_path / "v.toml"
    p.write_text('lanes = ["a"]\n\n[[vignette]]\nid = "a"\nsection = "chorus"\ntrigger = "we"\n'
                 'lane = "zz"\ntitle = "t"\nbadge = "schematic"\ncite = "c"\n', encoding="utf-8")
    with pytest.raises(VignetteError, match="lane"):  # unknown lane name
        load_vignettes(p)
    p.write_text(p.read_text(encoding="utf-8").replace('"zz"', '"scene"') + '\n[[clear]]\nsection = "chorus"\ntrigger = "we"\n', encoding="utf-8")
    loaded = load_vignettes(p)  # "scene" is always a valid lane; clears load with nth = 1
    assert loaded["vignettes"][0]["lane"] == "scene" and loaded["clears"] == [{"section": "chorus", "trigger": "we", "nth": 1}]
    p.write_text(p.read_text(encoding="utf-8").replace('"scene"', '"zz"').split("[[clear]]")[0], encoding="utf-8")
    p.write_text(p.read_text(encoding="utf-8").replace('"zz"', '"a"').replace('"t"', '"a theory of Mind"'), encoding="utf-8")
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
    ends = {sec["index"]: sec["endS"] for sec in tl["sections"]}
    panels = [c for c in tl["vignettes"] if c["lane"] != "scene"]
    for c in panels:  # exp09 H1: a panel stays >= 3 s (one frame of rounding), or runs to its cut and stays >= 2.5 s
        shown = c["endS"] - c["startS"]
        cut_limited = abs(c["endS"] - ends[c["sectionIndex"]]) < 1e-6 and ends[c["sectionIndex"]] - c["startS"] < 3.0
        assert shown >= (2.5 if cut_limited else 3.0 - 1 / 30), (c["id"], c["startS"], shown)
    for c in panels:  # exp09 H2: at most two panels at once (lanes a and b)
        assert sum(o["startS"] <= c["startS"] < o["endS"] for o in panels if o["sectionIndex"] == c["sectionIndex"]) <= 2
    assert {c["lane"] for c in panels} <= {"a", "b"}
    limits = next(c for c in tl["vignettes"] if c["id"] == "nngp")  # first mention: "Limits we can take ..."
    line = next(l for l in tl["lines"] if l["index"] == limits["lineIndex"])
    assert line["words"][0]["text"].lower().startswith("limits") and limits["startS"] <= line["words"][0]["startS"]


def test_lyric_tokens_match_the_written_lyrics():
    """lyric_tokens.json (written once by scripts/vignette_data.py) must still have one id list per word of every line,
    or the layer scene's chips would show stale ids after a lyric edit."""
    from anthem.lyrics import parse_lyrics  # same line numbering as timeline.json
    tokens = json.loads((ROOT / "video" / "public" / "vignettes" / "lyric_tokens.json").read_text(encoding="utf-8"))
    lines = [ln for sec in parse_lyrics((ROOT / "content" / "lyrics.txt").read_text(encoding="utf-8")) for ln in sec.lines]
    assert {str(ln.index): len(ln.words) for ln in lines} == {k: len(v) for k, v in tokens.items()}
    assert all(ids for v in tokens.values() for ids in v)  # every word has at least one token
