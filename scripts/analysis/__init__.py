"""Shared helpers for the experiment scripts in scripts/ (not part of the video pipeline).

Local: statistics (stats), independent timing references (references: Whisper; forced_alignment:
MMS_FA on a vocal stem; separation: Demucs), hand-labelled acoustic anchors (anchors), audio
timebase checks (timebase) and the pre-registered offset decision (decision).
Global context: exp03 (scripts/validate_alignment.py) and exp05 (scripts/validate_onset_offset.py)
import these, so both experiments compute the same quantities the same way. Heavy dependencies
(torch, torchaudio, demucs, faster-whisper) are imported inside functions, so the pure helpers stay
testable without the `analysis` dependency group.
"""
