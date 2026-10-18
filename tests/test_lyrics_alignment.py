"""Tests for anthem.lyrics, anthem.alignment and anthem.take_selection.

Local: parse Suno-tagged lyrics, map Suno's alignedWords onto the written words
(including tags glued to words, inserted/missing words), and rank takes.
Global context: these timings drive the karaoke highlight and the scene boundaries
in the video, so an off-by-one here would make every word light up at the wrong time.
Alignment algorithm source: difflib.SequenceMatcher opcodes
https://docs.python.org/3/library/difflib.html#difflib.SequenceMatcher.get_opcodes
"""

import pytest  # approx comparisons

from anthem.alignment import align_words, split_aligned_entries  # unit under test
from anthem.lyrics import normalize_word, parse_lyrics  # unit under test
from anthem.take_selection import score_alignment  # unit under test

LYRICS = """[Intro]
(Ooh, ooh)

[Verse 1]
A matrix and a bend,
Linear, then nonlinear!

[Chorus]
We will know! (We will know!)

[Chorus]
We will know!
"""  # small but covers tags, backing vocals, punctuation and a repeated section


def aw(word, start, end, success=True):
    """Local: one Suno alignedWords entry.  Global: matches the documented response fields."""
    return {"word": word, "startS": start, "endS": end, "success": success, "palign": 0}


def test_parse_sections_lines_words():
    sections = parse_lyrics(LYRICS)  # parse tagged lyrics
    assert [s.label for s in sections] == ["Intro", "Verse 1", "Chorus", "Chorus"]  # tags in order
    assert [s.kind for s in sections] == ["intro", "verse", "chorus", "chorus"]  # numbers stripped, lowercased
    assert [s.occurrence for s in sections] == [1, 1, 1, 2]  # repeated chorus counted
    chorus = sections[2].lines[0]  # "We will know! (We will know!)"
    assert [w.text for w in chorus.words] == ["We", "will", "know!", "(We", "will", "know!)"]  # display text kept
    assert [w.backing for w in chorus.words] == [False, False, False, True, True, True]  # parentheses = backing vocal
    assert sections[0].lines[0].words[0].backing  # intro "(Ooh," is backing


def test_normalize_word():
    assert normalize_word("know!)") == "know"  # punctuation stripped
    assert normalize_word("billion-dimensional,") == "billiondimensional"  # hyphen removed on both sides
    assert normalize_word("They've") == "theyve"  # apostrophe removed, lowercase


def test_split_aligned_entries_strips_tags_and_splits_multiword():
    tokens = split_aligned_entries([aw("[Verse 1]\nA ", 1.0, 1.2), aw("matrix and ", 1.2, 2.0)])  # glued tag + 2 words
    assert [t.norm for t in tokens] == ["a", "matrix", "and"]  # tag dropped, multiword split
    assert tokens[1].start == pytest.approx(1.2) and tokens[2].end == pytest.approx(2.0)  # span divided
    assert tokens[1].end == pytest.approx(tokens[2].start)  # contiguous split


def test_align_exact_and_with_missing_and_extra_words():
    sections = parse_lyrics("[Verse 1]\nA matrix and a bend\n")  # 5 words
    aligned = [aw("A", 0.0, 0.2), aw("matrix", 0.2, 0.6), aw("uh", 0.6, 0.7),  # "uh" is an extra sung word
               aw("a", 0.9, 1.0), aw("bend", 1.0, 1.5)]  # "and" was not aligned (missing)
    words, stats = align_words(sections, aligned)  # map timings onto the 5 lyric words
    assert [w.text for w in words] == ["A", "matrix", "and", "a", "bend"]  # one output per written word
    assert words[1].start == pytest.approx(0.2) and words[4].end == pytest.approx(1.5)  # matched words exact
    assert not words[2].matched and 0.6 <= words[2].start < words[2].end <= 0.9  # missing word interpolated in the gap
    assert stats["matched"] == 4 and stats["total"] == 5  # coverage counts


def test_score_alignment_ranks_coverage_then_cer():
    sections = parse_lyrics("[Chorus]\nWe will know\n")  # 3 words
    good = {"alignedWords": [aw("We", 0, 1), aw("will", 1, 2), aw("know", 2, 3)], "hootCer": 0.3}
    bad = {"alignedWords": [aw("We", 0, 1), aw("will", 1, 2, success=False)], "hootCer": 0.1}
    assert score_alignment(sections, good)["coverage"] == pytest.approx(1.0)  # all words aligned
    assert score_alignment(sections, bad)["coverage"] == pytest.approx(1 / 3)  # unsuccessful words do not count
    assert score_alignment(sections, {"error": "x"})["coverage"] == 0.0  # failed alignment ranks last


def test_repair_moves_too_early_mid_line_words_but_keeps_sustained_final_word():
    sections = parse_lyrics("[Verse 1]\nA matrix and\nWe will know!\n")  # artifact seen in take 1: "matrix" 7.7 s
    aligned = [aw("A", 0.0, 0.2), aw("matrix", 0.3, 5.0), aw("and", 5.0, 5.3),  # matrix starts ~4.5 s too early
               aw("We", 6.0, 6.2), aw("will", 6.2, 6.4), aw("know!", 6.4, 12.0)]  # final word held 5.6 s
    words, stats = align_words(sections, aligned)  # align + repair
    assert words[1].start == pytest.approx(4.5) and words[1].repaired  # long mid-line word shortened from the end
    assert (words[0].start, words[0].end) == (pytest.approx(4.3), pytest.approx(4.5))  # "A" pulled up to it
    assert words[5].end - words[5].start == pytest.approx(5.6) and not words[5].repaired  # sustain kept
    assert stats["repaired"] == 2  # exactly the two early words
