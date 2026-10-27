"""Parse Suno-format lyrics into sections, lines and words.

Local: splits content/lyrics.txt on [Section] tags, numbers repeated sections,
keeps each word's display text, a normalized matching key, and whether it sits
inside parentheses (Suno's convention for backing vocals).
Global context: the alignment phase matches these words against Suno's
alignedWords; the timeline phase turns sections into scenes and lines into
the karaoke overlay of the video.
Sources:
- [Section] tags vs (parenthesized) performance cues, a community convention (no official Suno page found):
  https://jackrighteous.com/en-us/blogs/music-creation-process-guide/meta-tag-structural-strategy-for-ai-lyric-formatting
- empirically, Suno's alignedWords for our song include the parenthesized words (data/song/*/*_aligned.json)
- regex: https://docs.python.org/3/library/re.html
"""

import re  # tag + punctuation handling
from dataclasses import dataclass, field  # immutable records

TAG = re.compile(r"^\[(?P<label>[^\]]+)\]\s*$")  # a line that is only "[Something]"
NON_ALNUM = re.compile(r"[^0-9a-z]+")  # everything that is not a lowercase letter/digit


def normalize_word(text: str) -> str:
    """Local: lowercase and strip all non-alphanumerics ("They've," -> "theyve").
    Global: the same key is computed for Suno's words, so punctuation/case never block a match."""
    return NON_ALNUM.sub("", text.lower())  # e.g. "billion-dimensional" -> "billiondimensional"


@dataclass(frozen=True)
class Word:
    """Local: one written word.  Global: becomes one karaoke-highlight unit in the video."""

    text: str  # display text with punctuation, e.g. "know!)"
    norm: str  # matching key, e.g. "know"
    line_index: int  # global line number
    section_index: int  # owning section
    backing: bool  # inside (...) -> backing vocal


@dataclass(frozen=True)
class Line:
    """Local: one lyric line.  Global: one caption shown at a time in the overlay."""

    index: int  # global line number (0-based, across sections)
    section_index: int  # owning section
    text: str  # raw line text
    words: list[Word] = field(default_factory=list)  # its words in order


@dataclass(frozen=True)
class Section:
    """Local: one [Tag] block.  Global: one scene of the video."""

    index: int  # 0-based order in the song
    label: str  # tag text, e.g. "Verse 1"
    kind: str  # label without trailing number, lowercased, e.g. "verse"
    occurrence: int  # 1 for the first chorus, 2 for the second, ...
    lines: list[Line] = field(default_factory=list)  # its lines


def section_keys(kind: str, occurrence: int) -> tuple[str, str]:
    """Local: the config keys that address a section, most specific first ("chorus 2", then "chorus").
    Global: shared by content/scenes.toml (timeline._scene_for) and content/vignettes.toml (vignettes.place_vignettes)."""
    return f"{kind} {occurrence}", kind


def parse_lyrics(text: str) -> list[Section]:
    """Local: parse tagged lyrics into Section/Line/Word records.
    Global: single source of truth for the written words used by alignment and the overlay."""
    sections: list[Section] = []  # result
    counts: dict[str, int] = {}  # occurrences per kind
    line_index = 0  # global line counter
    for raw in text.splitlines():  # one lyric line at a time
        stripped = raw.strip()  # ignore indentation/trailing spaces
        if not stripped:  # blank separator line
            continue
        if m := TAG.match(stripped):  # a new section begins
            label = m["label"].strip()  # e.g. "Verse 1"
            kind = re.sub(r"\s*\d+$", "", label).lower()  # drop trailing number -> "verse"
            counts[kind] = counts.get(kind, 0) + 1  # n-th time this kind appears
            sections.append(Section(len(sections), label, kind, counts[kind]))  # open it
            continue
        if not sections:  # lyrics before any tag: put them in an implicit intro
            counts["intro"] = 1
            sections.append(Section(0, "Intro", "intro", 1))
        sec = sections[-1]  # current section
        words, depth = [], 0  # parenthesis depth tracks backing vocals across words
        for token in stripped.split():  # whitespace tokenization, as Suno's aligner does
            depth += token.count("(")  # entering "(We" opens backing
            backing = depth > 0  # inside parentheses
            depth = max(0, depth - token.count(")"))  # "know!)" closes it after this word
            if norm := normalize_word(token):  # skip pure punctuation tokens like "-"
                words.append(Word(token, norm, line_index, sec.index, backing))
        sec.lines.append(Line(line_index, sec.index, stripped, words))  # dataclass list is mutable
        line_index += 1  # next global line
    return sections


def all_words(sections: list[Section]) -> list[Word]:
    """Local: flatten words in song order.  Global: the sequence aligned against Suno's words."""
    return [w for s in sections for line in s.lines for w in line.words]  # nested flatten
