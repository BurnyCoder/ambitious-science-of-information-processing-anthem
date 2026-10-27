"""The illustration track: figure cards timed to the sung words they illustrate.

Local: reads content/vignettes.toml (named slot boxes plus one [[vignette]] per card), finds each card's
trigger word in its section's timed lyrics and turns the card into {id, startS, endS, slot, ...}. A card
never outlives its section, and cards that share a slot never overlap (the earlier one is trimmed).
Global context: build_timeline() calls place_vignettes(), so timeline.json carries the cards next to the
karaoke words they are synced to; video/src/components/VignetteLayer.tsx draws them, and
vignette_coverage() is the pre-specified "every sung line is illustrated" metric of reports/exp07.
Sources: tomllib https://docs.python.org/3/library/tomllib.html ,
         re.search https://docs.python.org/3/library/re.html#re.search
"""

import logging  # trims and warnings
import re  # trigger regexes
import tomllib  # content/vignettes.toml
from pathlib import Path  # paths

from anthem.lyrics import normalize_word, section_keys  # word keys + "chorus 2"/"chorus" lookup
from anthem.song import find_banned  # the author's banned-word guard

log = logging.getLogger(__name__)  # module logger

LEAD_S = 0.15  # a card lands just before its word, like the karaoke lead-in
READ_S = 2.0  # a card triggered right before a cut may spill past it so it is shown at least this long
MIN_SHOW_S = 1.0  # shorter cards (after same-slot trimming) cannot be read; logged as a warning
BADGES = ("released data", "published numbers", "live math", "from the paper", "schematic")  # provenance label on every card
REQUIRED = ("id", "section", "trigger", "slot", "title", "badge", "cite")  # fields a card must declare
DEFAULTS = {"hold": 6.0, "nth": 1, "text": "", "url": ""}  # optional fields


class VignetteError(ValueError):
    """Local: a card that cannot be loaded or placed.  Global: stops the timeline phase with the reason."""


def load_vignettes(path: Path, banned=()) -> dict:
    """Local: read and validate the catalog, filling defaults.  Global: input of place_vignettes()."""
    raw = tomllib.loads(path.read_text(encoding="utf-8"))  # {"slots": {...}, "vignette": [...]}
    slots = raw.get("slots", {})  # name -> [x, y, w, h] in 1920x1080 pixels
    cards = []  # validated cards
    for i, v in enumerate(raw.get("vignette", [])):
        if missing := [k for k in REQUIRED if k not in v]:  # incomplete entry
            raise VignetteError(f"vignette #{i} ({v.get('id')}) lacks {missing}")
        if v["slot"] not in slots:  # typo in the slot name
            raise VignetteError(f"vignette {v['id']}: unknown slot {v['slot']!r} (known: {sorted(slots)})")
        if v["badge"] not in BADGES:  # every card must say where its content comes from
            raise VignetteError(f"vignette {v['id']}: badge {v['badge']!r} not in {BADGES}")
        if word := find_banned(" ".join(str(x) for x in v.values()), banned):  # on-screen text obeys the lyric rule
            raise VignetteError(f"vignette {v['id']} contains the banned word {word!r}")
        cards.append({**DEFAULTS, **v})  # explicit values win over defaults
    return {"slots": slots, "vignettes": cards}


def place_vignettes(spec: dict, timeline: dict) -> list[dict]:
    """Local: one timed card per (card, matching section), at the nth sung word matching its trigger.
    Global: the "vignettes" array of timeline.json, sorted by start time."""
    placed = []  # result
    for v in spec["vignettes"]:
        sections = [s for s in timeline["sections"] if v["section"] in section_keys(s["kind"], s["occurrence"])]
        if not sections:  # e.g. "verse 9"
            raise VignetteError(f"vignette {v['id']}: no section matches {v['section']!r}")
        for sec in sections:  # a generic key ("chorus") places one card per occurrence
            hits = [(line, w) for line in timeline["lines"] if line["sectionIndex"] == sec["index"]
                    for w in line["words"] if re.search(v["trigger"], normalize_word(w["text"]))]  # sung order
            if len(hits) < v["nth"]:  # the word the card illustrates is not sung here
                raise VignetteError(f"vignette {v['id']}: trigger {v['trigger']!r} #{v['nth']} is never sung in {sec['label']}")
            line, word = hits[v["nth"] - 1]  # the chosen occurrence
            start = max(sec["startS"], word["startS"] - LEAD_S)  # just before the word, never before the cut
            end = min(start + v["hold"], max(sec["endS"], start + READ_S))  # ends at the cut unless that is too soon
            placed.append({"id": v["id"], "slot": v["slot"], "sectionIndex": sec["index"], "lineIndex": line["index"],
                           "startS": round(start, 3), "endS": round(end, 3),
                           "title": v["title"], "text": v["text"], "badge": v["badge"], "cite": v["cite"], "url": v["url"]})
    return _trim_slots(sorted(placed, key=lambda c: c["startS"]))  # stable: equal starts keep catalog order


def _trim_slots(cards: list[dict]) -> list[dict]:
    """Local: end each card where the next card in the same slot begins.  Global: one card per box at a time."""
    current: dict[str, dict] = {}  # slot -> card occupying it
    for c in cards:  # in start order
        prev = current.get(c["slot"])
        if prev and prev["endS"] > c["startS"]:  # overlap in the same box
            log.info("Card %s trimmed from %.2f to %.2f s by %s (slot %s)", prev["id"], prev["endS"], c["startS"], c["id"], c["slot"])
            prev["endS"] = c["startS"]
        current[c["slot"]] = c
    if short := [c["id"] for c in cards if c["endS"] - c["startS"] < MIN_SHOW_S]:  # unreadable cards
        log.warning("Cards shown for < %.1f s: %s", MIN_SHOW_S, short)
    return cards


def vignette_coverage(timeline: dict) -> float | None:
    """Local: share of sung non-backing lines with at least one card triggered by one of their words.
    Global: pre-specified metric (target 1.0) reported in timeline meta and reports/exp07."""
    lines = [line["index"] for line in timeline["lines"] if not line["backing"]]  # lines the lead vocal sings
    if not lines:
        return None
    covered = {c["lineIndex"] for c in timeline.get("vignettes", [])}  # lines that got a card
    return round(sum(i in covered for i in lines) / len(lines), 4)
