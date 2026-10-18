"""Pick one of Suno's takes with a rule fixed before generation.

Local: scores each take by alignment coverage (share of written words exactly matched
to a Suno word with success=true) and breaks ties by the lower hootCer (Suno's
alignment error score), unless the user forces a take id.
Global context: runs right after the song phase; the chosen take's audio and word
timings become the soundtrack and karaoke timing of the video. Fixing the rule up front
avoids picking whichever take happens to make the video look best (no cherry-picking).
Source for hootCer / success fields: https://docs.sunoapi.org/suno-api/get-timestamped-lyrics
"""

import json  # read the raw timing files
import logging  # log every score

from anthem.alignment import align_words  # coverage is computed by the real aligner
from anthem.lyrics import Section  # written words
from anthem.song import Song, Take  # takes on disk

log = logging.getLogger(__name__)  # module logger


def score_alignment(sections: list[Section], timings: dict) -> dict:
    """Local: coverage + hootCer for one take's raw timestamped-lyrics JSON.
    Global: the pre-specified ranking key; a failed fetch scores lowest."""
    if "alignedWords" not in timings:  # e.g. {"error": ...} written by the song phase
        return {"coverage": 0.0, "hoot_cer": None, "matched": 0, "total": 0, "repaired": 0}  # None: JSON-safe
    _, stats = align_words(sections, timings["alignedWords"])  # same aligner the video uses
    return {**stats, "hoot_cer": timings.get("hootCer")}  # lower CER is better; None if absent


def select_take(song: Song, sections: list[Section], forced_id: str | None = None) -> tuple[Take, list[dict]]:
    """Local: return (chosen take, all scores).  Global: decides which audio the video is cut to."""
    scores = []  # one record per take
    for take in song.takes:  # usually two
        s = score_alignment(sections, json.loads(take.aligned_path.read_text(encoding="utf-8")))  # score it
        scores.append({"take_id": take.id, "file": take.audio_path.name, **s})  # keep for the report
        log.info("Take %s: coverage=%.4f hootCer=%s matched=%s/%s repaired=%s", take.id, s["coverage"],
                 s["hoot_cer"], s["matched"], s["total"], s["repaired"])
    if forced_id:  # explicit user override (--take)
        chosen = next(t for t in song.takes if t.id.startswith(forced_id))  # prefix match is enough
        log.info("Take %s forced by --take", chosen.id)
    else:  # pre-specified rule: max coverage, then min hootCer
        best = max(scores, key=lambda s: (s["coverage"], -(s["hoot_cer"] if s["hoot_cer"] is not None else 1e9)))
        chosen = next(t for t in song.takes if t.id == best["take_id"])
        log.info("Take %s selected by rule (max coverage, then min hootCer)", chosen.id)
    return chosen, scores
