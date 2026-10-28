"""Python mirror of the video's shot lifecycle (video/src/stage/shots.ts) for experiment 08.

Local: shots_at() and heroness() reproduce shots.ts line for line; the timing constants, the hero poses, the
scenes whose cards fly past the camera and the scenes with giant lyrics are read from the TypeScript sources, so the
two cannot drift apart silently. tests/test_integration.py runs the same cases as video/tests/shots.test.ts.
Global context: scripts/validate_integration.py measures how much of the song a figure is centre stage, how much
of the frame it covers and how many cards dock into scene objects, from timeline.json alone (no render needed).
Sources: smoothstep https://en.wikipedia.org/wiki/Smoothstep ; regular expressions https://docs.python.org/3/library/re.html
"""

import re  # constants from the TypeScript sources
from pathlib import Path  # source paths

SRC = Path(__file__).resolve().parents[2] / "video" / "src"  # the Remotion sources
_shots = (SRC / "stage" / "shots.ts").read_text(encoding="utf-8")
_shot = (SRC / "stage" / "Shot.tsx").read_text(encoding="utf-8")
C = {k: float(v) for k, v in re.findall(r"export const (\w+_S) = ([\d.]+);", _shots)}  # EMERGE_S, HERO_MAX_S, EASE_S, DOCK_S
HERO_SCALE = {name: float(s) for name, s in re.findall(r"const (HERO|HERO_BIG): Pose = \{x: \d+, y: \d+, s: ([\d.]+)", _shot)}  # hero scales
NATIVE_W = float(re.search(r"NATIVE_W = (\d+)", _shot).group(1))  # card layout width (px)
BODY_H = float(re.search(r"BODY_H = (\d+)", _shot).group(1))  # card body height (px)
CARD_H = BODY_H + 100  # nominal card height: body + title (~34 px) + caption (~40 px) + lower third (~26 px)
PAST_SCENES = set(re.findall(r"case '(\w+)':\s*return \{[^\n]*dock: PAST\}", (SRC / "stage" / "anchors.ts").read_text(encoding="utf-8")))  # fly-through scenes
BIG_SCENES = set(re.findall(r"(\w+): \{component: \w+, caption: '[^']*', bigLyrics: true\}", (SRC / "scenes" / "index.ts").read_text(encoding="utf-8")))  # giant-lyric scenes


def ease(x: float) -> float:
    """Local: Hermite smoothstep on a clamped input (shots.ts `ease`).  Global: every eased step."""
    c = min(1.0, max(0.0, x))
    return c * c * (3 - 2 * c)


def shots_at(vignettes: list[dict], sections: list[dict], t: float) -> list[dict]:
    """Local: every card visible at t with its emerge/rank/dock numbers (shots.ts `shotsAt`).
    Global: the per-frame state that exp08 aggregates."""
    out = []
    for i, v in enumerate(vignettes):
        section_end = next((s["endS"] for s in sections if s["index"] == v["sectionIndex"]), v["endS"])  # docks live until the cut
        if t < v["startS"] or t >= max(section_end, v["endS"] + C["DOCK_S"]):
            continue  # not yet, or gone with its section
        rank = ease((t - v["startS"] - C["HERO_MAX_S"]) / C["EASE_S"])  # hero time ran out
        for n in vignettes:
            if n["sectionIndex"] != v["sectionIndex"] or n["startS"] <= v["startS"] or n is v:
                continue  # only newer cards of the same section push back
            rank += ease((t - n["startS"]) / C["EASE_S"]) - ease((t - n["endS"]) / C["EASE_S"])
        k = sum(1 for u in vignettes if u["sectionIndex"] == v["sectionIndex"] and u["startS"] < v["startS"])  # order in its section
        out.append({"v": v, "fig": i + 1, "k": k, "emerge": ease((t - v["startS"]) / C["EMERGE_S"]), "rank": max(0.0, rank),
                    "dock": ease((t - v["endS"]) / C["DOCK_S"])})
    return out


def heroness(s: dict) -> float:
    """Local: how much a shot is the hero (0..1) (shots.ts `heroness`).  Global: hero share and coverage."""
    return s["emerge"] * (1 - min(1.0, s["rank"])) * (1 - s["dock"])


def hero_area_fraction(scene: str, w: int = 1920, h: int = 1080) -> float:
    """Local: nominal share of the frame covered by a full hero in this scene (card box × hero scale²).
    Global: the balance rule "a hero covers at most about 60 % of the frame"."""
    s = HERO_SCALE["HERO_BIG" if scene in BIG_SCENES else "HERO"]
    return (NATIVE_W * s) * (CARD_H * s) / (w * h)
