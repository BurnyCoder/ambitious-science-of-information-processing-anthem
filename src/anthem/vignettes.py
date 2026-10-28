"""The illustration track: figure cards timed to the sung words they illustrate.

Local: reads content/vignettes.toml (a list of lanes, one [[vignette]] per card, and [[clear]] cues), finds each
card's trigger word in its section's timed lyrics and turns the card into {id, startS, endS, lane, ...}. A card
never outlives its section (no spill over the next scene), cards that share a lane never overlap (the earlier one
is trimmed), so at most len(lanes) panels are in a scene at once. Lane "scene" means the scene draws the card itself,
in place, so it is never trimmed. A [[clear]] cue ends every earlier card of its section just before a highlight.
Global context: build_timeline() calls place_vignettes(), so timeline.json carries the cards next to the
karaoke words they are synced to; video/src/stage/ puts lane a/b cards into their scene's panel slots
(stage/layout.json) and scenes draw their "scene" cards, and
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
SCENE_LANE = "scene"  # reserved lane: the scene draws the card itself (no slot, no trimming)
CLEAR_LEAD_S = 0.5  # a [[clear]] cue ends earlier cards this long before its word, so they have docked when it is sung
MIN_SHOW_S = 1.0  # shorter panels (after same-lane trimming) cannot be read; logged as a warning (scene-drawn cards are exempt)
BADGES = ("released data", "published numbers", "live math", "from the paper", "schematic")  # provenance label on every card
REQUIRED = ("id", "section", "trigger", "lane", "title", "badge", "cite")  # fields a card must declare
DEFAULTS = {"hold": 6.0, "nth": 1, "text": "", "url": ""}  # optional fields


class VignetteError(ValueError):
    """Local: a card that cannot be loaded or placed.  Global: stops the timeline phase with the reason."""


def load_vignettes(path: Path, banned=()) -> dict:
    """Local: read and validate the catalog, filling defaults.  Global: input of place_vignettes()."""
    raw = tomllib.loads(path.read_text(encoding="utf-8"))  # {"lanes": [...], "vignette": [...], "clear": [...]}
    lanes = raw.get("lanes", [])  # concurrency lanes
    cards = []  # validated cards
    for i, v in enumerate(raw.get("vignette", [])):
        if missing := [k for k in REQUIRED if k not in v]:  # incomplete entry
            raise VignetteError(f"vignette #{i} ({v.get('id')}) lacks {missing}")
        if v["lane"] not in lanes and v["lane"] != SCENE_LANE:  # typo in the lane name
            raise VignetteError(f"vignette {v['id']}: unknown lane {v['lane']!r} (known: {lanes})")
        if int(v.get("nth", 1)) < 1:  # 0 or negative would silently pick the last match
            raise VignetteError(f"vignette {v['id']}: nth must be >= 1")
        if v["badge"] not in BADGES:  # every card must say where its content comes from
            raise VignetteError(f"vignette {v['id']}: badge {v['badge']!r} not in {BADGES}")
        if word := find_banned(" ".join(str(x) for x in v.values()), banned):  # on-screen text obeys the lyric rule
            raise VignetteError(f"vignette {v['id']} contains the banned word {word!r}")
        cards.append({**DEFAULTS, **v})  # explicit values win over defaults
    clears = [{"section": c["section"], "trigger": c["trigger"], "nth": int(c.get("nth", 1))} for c in raw.get("clear", [])]  # highlight cues
    return {"lanes": lanes, "vignettes": cards, "clears": clears}


def _hits(timeline: dict, sec: dict, trigger: str) -> list[tuple[dict, dict]]:
    """Local: (line, word) pairs of a section whose word matches `trigger`, in sung order.
    Global: shared by card placement and [[clear]] cues."""
    return [(line, w) for line in timeline["lines"] if line["sectionIndex"] == sec["index"]
            for w in line["words"] if re.search(trigger, normalize_word(w["text"]))]


def place_vignettes(spec: dict, timeline: dict) -> list[dict]:
    """Local: one timed card per (card, matching section), at the nth sung word matching its trigger.
    Global: the "vignettes" array of timeline.json, sorted by start time."""
    placed = []  # result
    for v in spec["vignettes"]:
        sections = [s for s in timeline["sections"] if v["section"] in section_keys(s["kind"], s["occurrence"])]
        if not sections:  # e.g. "verse 9"
            raise VignetteError(f"vignette {v['id']}: no section matches {v['section']!r}")
        for sec in sections:  # a generic key ("chorus") places one card per occurrence
            hits = _hits(timeline, sec, v["trigger"])  # sung order
            if len(hits) < v["nth"]:  # the word the card illustrates is not sung here
                raise VignetteError(f"vignette {v['id']}: trigger {v['trigger']!r} #{v['nth']} is never sung in {sec['label']}")
            line, word = hits[v["nth"] - 1]  # the chosen occurrence
            start = max(sec["startS"], word["startS"] - LEAD_S)  # just before the word, never before the cut
            end = min(start + v["hold"], sec["endS"])  # never past the cut: a panel must not hang over the next scene
            placed.append({"id": v["id"], "lane": v["lane"], "sectionIndex": sec["index"], "lineIndex": line["index"],
                           "startS": round(start, 3), "endS": round(end, 3),
                           "title": v["title"], "text": v["text"], "badge": v["badge"], "cite": v["cite"], "url": v["url"]})
    cards = _trim_lanes(sorted(placed, key=lambda c: c["startS"]))  # stable: equal starts keep catalog order
    for c in spec.get("clears", []):  # highlight lines: earlier cards leave before the cue word
        for sec in [s for s in timeline["sections"] if c["section"] in section_keys(s["kind"], s["occurrence"])]:
            hits = _hits(timeline, sec, c["trigger"])
            if len(hits) < c["nth"]:
                raise VignetteError(f"clear {c['trigger']!r} #{c['nth']} is never sung in {sec['label']}")
            cue = hits[c["nth"] - 1][1]["startS"]  # the highlight word
            for card in cards:
                if card["sectionIndex"] == sec["index"] and card["startS"] < cue - LEAD_S - 1e-6:  # earlier cards only
                    card["endS"] = min(card["endS"], round(cue - CLEAR_LEAD_S, 3))
    return cards


def _trim_lanes(cards: list[dict]) -> list[dict]:
    """Local: end each card where the next card in the same lane begins.  Global: caps cards on stage at once."""
    current: dict[str, dict] = {}  # lane -> card occupying it
    for c in [c for c in cards if c["lane"] != SCENE_LANE]:  # in start order; scene-drawn cards take no lane
        prev = current.get(c["lane"])
        if prev and prev["endS"] > c["startS"]:  # overlap in the same box
            log.info("Card %s trimmed from %.2f to %.2f s by %s (lane %s)", prev["id"], prev["endS"], c["startS"], c["id"], c["lane"])
            prev["endS"] = c["startS"]
        current[c["lane"]] = c
    if short := [c["id"] for c in cards if c["lane"] != SCENE_LANE and c["endS"] - c["startS"] < MIN_SHOW_S]:  # unreadable panels
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
