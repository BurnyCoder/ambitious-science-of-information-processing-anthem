"""Map Suno's word timings (alignedWords) onto the written lyric words.

Local: cleans Suno's tokens (section tags and line breaks are glued onto words, e.g.
"[Verse 1]\\nA "), sequence-aligns them to the written words with difflib, interpolates
words Suno skipped, and repairs one artifact seen in our real takes: mid-line words whose
start is seconds too early ("matrix" spanning 7.7 s), together with the words left behind before them.
Global context: the resulting per-word start/end times drive the karaoke highlight
and, via each section's first word, the scene boundaries of the video.
Sources:
- difflib.SequenceMatcher.get_opcodes (equal/replace/delete/insert blocks):
  https://docs.python.org/3/library/difflib.html#difflib.SequenceMatcher.get_opcodes
- alignedWords fields (word, startS, endS, success):
  https://docs.sunoapi.org/suno-api/get-timestamped-lyrics
"""

import re  # strip [Section] tags from Suno tokens
from dataclasses import dataclass, replace  # immutable records + copy-with-changes
from difflib import SequenceMatcher  # stdlib sequence alignment (Ratcliff/Obershelp)

from anthem.lyrics import Section, all_words, normalize_word  # written words

TAG_IN_TOKEN = re.compile(r"\[[^\]]*\]")  # "[Verse 1]" glued to the following word
MAX_MID_WORD_S = 3.0  # a non-final word longer than this (> 6 beats at 129 BPM) has a mis-placed start (v1: 1.2)
MAX_MID_GAP_S = 0.6  # a word this far before its repaired successor follows it (chain)
REPAIRED_WORD_S = 0.5  # duration given to a repaired word (~a quarter note at 124 BPM is 0.48 s)


@dataclass(frozen=True)
class Token:
    """Local: one cleaned Suno word with its time span.  Global: the "sung" side of the alignment."""

    norm: str  # matching key
    start: float  # seconds
    end: float  # seconds
    success: bool  # Suno's own per-word alignment flag


@dataclass(frozen=True)
class TimedWord:
    """Local: a written word with a time span.  Global: one highlight unit in the karaoke overlay."""

    text: str  # display text
    norm: str  # matching key
    line_index: int  # owning line
    section_index: int  # owning section
    backing: bool  # backing vocal (in parentheses)
    start: float  # seconds
    end: float  # seconds
    matched: bool  # exact match to a Suno word with success=True
    repaired: bool = False  # timing changed by repair_timings()


def split_aligned_entries(aligned: list[dict]) -> list[Token]:
    """Local: drop tags, split multi-word entries, divide their span evenly.
    Global: turns Suno's raw alignedWords into tokens comparable with the written words."""
    tokens = []  # cleaned tokens in sung order
    for entry in aligned:  # each raw Suno entry
        parts = [p for p in (normalize_word(x) for x in TAG_IN_TOKEN.sub(" ", entry["word"]).split()) if p]  # keys
        if not parts:  # tag-only or punctuation-only entry such as "[Intro]\n\n\n("
            continue
        start, end = float(entry["startS"]), float(entry["endS"])  # raw span
        step = (end - start) / len(parts)  # equal share per word
        for k, part in enumerate(parts):  # one token per word
            tokens.append(Token(part, start + k * step, start + (k + 1) * step, bool(entry.get("success", True))))
    return tokens


def _interpolate(spans: list[tuple[float, float] | None]) -> list[tuple[float, float]]:
    """Local: give unmatched words evenly spaced slots between their timed neighbours.
    Global: every written word gets a time, so the overlay never skips a word."""
    out = list(spans)  # copy
    i = 0  # scan position
    while i < len(out):
        if out[i] is not None:  # already timed
            i += 1
            continue
        j = i  # find the end of this run of untimed words
        while j < len(out) and out[j] is None:
            j += 1
        left = out[i - 1][1] if i > 0 else 0.0  # previous word's end (or song start)
        right = out[j][0] if j < len(out) else left + 0.4 * (j - i)  # next word's start (or ~0.4 s per word)
        step = max(right - left, 0.0) / (j - i)  # share of the gap per word
        for k in range(i, j):  # fill the run
            out[k] = (left + (k - i) * step, left + (k - i + 1) * step)
        i = j  # continue after the run
    return out


def repair_timings(words: list[TimedWord]) -> list[TimedWord]:
    """Local: within each line, walking backwards: a mid-line word longer than MAX_MID_WORD_S gets its start
    moved to just before its (trusted) end; words before it that are left behind by more than MAX_MID_GAP_S
    follow it as a chain.
    Global: fixes Suno artifacts so a word lights up when it is sung, not seconds before.
    v2 (reports/exp03): v1 used a 1.2 s threshold and an unconditional gap rule; the Whisper check showed it
    shortened real sung notes ("go", 1.64 s) and the created gap cascaded lines 0.8-2.5 s late.
    Line-final words are left alone: long final words are real sustained notes ("know!" held 6 s)."""
    out = list(words)  # copy
    for i in range(len(out) - 2, -1, -1):  # backwards so chains of early words move together
        w, nxt = out[i], out[i + 1]  # this word and the following one
        if w.line_index != nxt.line_index:  # line-final word: keep sustain
            continue
        if w.end - w.start > MAX_MID_WORD_S:  # implausibly long mid-line word -> start too early
            out[i] = replace(w, start=w.end - REPAIRED_WORD_S, repaired=True)  # keep its end, shorten
        elif nxt.repaired and nxt.start - w.end > MAX_MID_GAP_S:  # successor moved later, this word left behind
            dur = min(w.end - w.start, REPAIRED_WORD_S)  # keep short words short
            out[i] = replace(w, start=nxt.start - dur, end=nxt.start, repaired=True)  # follow the successor
    return out


def align_words(sections: list[Section], aligned: list[dict], repair: bool = True):
    """Local: return (timed words in written order, stats dict).
    Global: the single place where sung time meets written text."""
    written = all_words(sections)  # written side
    tokens = split_aligned_entries(aligned)  # sung side
    sm = SequenceMatcher(None, [w.norm for w in written], [t.norm for t in tokens], autojunk=False)  # no junk heuristic
    spans: list[tuple[float, float] | None] = [None] * len(written)  # time per written word
    matched = [False] * len(written)  # exact + successful match flags
    for tag, i1, i2, j1, j2 in sm.get_opcodes():  # aligned blocks
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):  # one-to-one blocks
            for k in range(i2 - i1):  # pair words positionally
                tok = tokens[j1 + k]
                spans[i1 + k] = (tok.start, tok.end)  # borrow the sung span
                matched[i1 + k] = tag == "equal" and tok.success  # spelling variants are timed but not "matched"
    spans = _interpolate(spans)  # fill deletions (written words Suno did not report)
    words = [TimedWord(w.text, w.norm, w.line_index, w.section_index, w.backing, s, e, m)
             for w, (s, e), m in zip(written, spans, matched)]  # combine
    if repair:
        words = repair_timings(words)  # fix early starts / mid-line gaps
    stats = {"total": len(words), "matched": sum(matched), "unmatched": sum(not m for m in matched),
             "repaired": sum(w.repaired for w in words), "tokens": len(tokens)}  # report numbers
    stats["coverage"] = stats["matched"] / stats["total"] if stats["total"] else 0.0  # pre-specified metric
    return words, stats
