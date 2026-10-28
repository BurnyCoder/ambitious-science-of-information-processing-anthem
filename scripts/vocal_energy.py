"""Vocal envelope of the take the video uses: the atlas's field graph grows with the voice (exp10).

Local: reads the Demucs vocal stem of the chosen take (written by experiment 06 into out/exp06/, see
scripts/analysis/separation.py), takes its RMS per video frame with the pipeline's own definition
(anthem.audio_analysis.frame_rms), smooths it over SMOOTH_S and writes video/public/vignettes/vocal_energy.json
with the stem's sha256 for provenance.
Global context: AtlasScene scales its sphere by this envelope, so the graph of fields swells with the singing
instead of dimming. No model is run here; the stem already exists (reuse released results first).
Sources: librosa.load https://librosa.org/doc/latest/generated/librosa.load.html ;
moving average with numpy.convolve https://numpy.org/doc/stable/reference/generated/numpy.convolve.html
Usage: uv run python -I scripts/vocal_energy.py
"""

import hashlib  # stem provenance
import json  # timeline + output
import logging  # timestamped logs
import sys  # import paths (-I drops the script directory)
from pathlib import Path  # paths

import librosa  # decoding + resampling
import numpy as np  # smoothing

ROOT = Path(__file__).resolve().parents[1]  # repo root
sys.path[:0] = [str(ROOT / "src")]  # pipeline package
from anthem.audio_analysis import SR, _normalize, frame_rms  # same loudness definition as timeline.json's energy
from anthem.logging_setup import setup_logging  # terminal + file logs

SONG = ROOT / "data" / "song" / "song.json"  # the chosen take
TIMELINE = ROOT / "video" / "public" / "timeline.json"  # fps + frame count
OUT = ROOT / "video" / "public" / "vignettes" / "vocal_energy.json"  # committed, small
SMOOTH_S = 0.4  # moving-average window: follows phrases, not syllables
log = logging.getLogger("vocal_energy")  # stable logger name


def main() -> None:
    """Local: stem -> smoothed, normalized per-frame vocal RMS -> JSON.  Global: input of AtlasScene."""
    setup_logging(ROOT / "logs", prefix="vocal_energy")
    take = json.loads(SONG.read_text(encoding="utf-8"))["takes"][0]  # the take timeline.json was built from
    stem = ROOT / "out" / "exp06" / f"{Path(take['audio_path']).stem}_vocals.wav"  # exp06's Demucs vocals
    tl = json.loads(TIMELINE.read_text(encoding="utf-8"))
    y, sr = librosa.load(stem, sr=SR, mono=True)  # mono 22.05 kHz, as the song's analysis
    log.info("Stem %s: %.2f s (timeline %.2f s)", stem.name, len(y) / sr, tl["durationS"])
    rms = frame_rms(y, sr, tl["durationInFrames"], tl["fps"])  # 0..1 per video frame
    k = max(1, round(SMOOTH_S * tl["fps"]))  # window in frames
    env = _normalize(np.convolve(rms, np.ones(k) / k, mode="same"))  # centred moving average, renormalized
    OUT.write_text(json.dumps({"source": f"out/exp06/{stem.name}", "sha256": hashlib.sha256(stem.read_bytes()).hexdigest(),
                               "fps": tl["fps"], "smoothS": SMOOTH_S, "energy": [round(float(v), 3) for v in env]}), encoding="utf-8")
    log.info("Wrote %s: %d frames, mean %.3f, frames > 0.5: %.1f %%", OUT.relative_to(ROOT), len(env), env.mean(), 100 * (env > 0.5).mean())


if __name__ == "__main__":
    main()
