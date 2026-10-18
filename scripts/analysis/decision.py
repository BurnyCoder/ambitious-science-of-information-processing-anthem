"""The pre-registered decision rule of exp05 (reports/exp05_onset_offset.md, "Decision rule").

Local: turns the primary offset estimate δ (Suno − MMS), the MMS bias on hand-labelled anchors β,
and the anchor-based Suno offset α_S into the global word-time offset for the video (or 0).
Global context: the only place the experiment's outcome becomes a code change; it is pure and
unit-tested so the rule cannot drift after the data are seen.
"""

from analysis.stats import excludes_zero  # CI condition

FRAME_S = 1 / 30  # one video frame at 30 fps (D2)
BETA_MAX_S = 0.05  # |β| bound for a validated reference (D3)
MIN_ANCHORS = 10  # usable anchors needed for D3


def decide_offset(delta: float, delta_ci, beta: float, n_anchors: int, alpha_s: float, alpha_s_ci,
                  frame_s: float = FRAME_S, beta_max: float = BETA_MAX_S, min_anchors: int = MIN_ANCHORS) -> dict:
    """Local: conditions D1-D4 and the resulting offset (seconds to ADD to Suno word times).
    Global: VIDEO_WORD_OFFSET_S is set to `offset_s` only if this says so."""
    d = {"D1_ci_excludes_0": excludes_zero(delta_ci),  # the lag is not noise
         "D2_at_least_one_frame": abs(delta) >= frame_s,  # the lag is visible at 30 fps
         "D3_reference_validated": n_anchors >= min_anchors and abs(beta) <= beta_max,  # MMS is right in absolute time
         "D4_anchors_agree": (alpha_s > 0) == (delta > 0) and excludes_zero(alpha_s_ci)}  # physical onsets agree
    if all(d.values()):  # primary path: MMS-based estimate
        offset, basis = -delta, "mms"
    elif not d["D3_reference_validated"] and d["D4_anchors_agree"] and abs(alpha_s) >= frame_s:  # fallback
        offset, basis = -alpha_s, "anchors"
    else:  # conflicting or insufficient evidence
        offset, basis = 0.0, None
    return {**d, "offset_s": round(offset, 3), "basis": basis}
