"""Vocal separation with Demucs (htdemucs), cached as a WAV next to a small JSON sidecar.

Local: decodes a take at the model's rate (librosa), runs demucs.api.Separator.separate_tensor with the
pre-registered default settings, writes the vocal stem, and records the mix-vs-sum-of-stems lag.
Global context: exp05 aligns the lyrics on the isolated voice instead of the orchestral mix; the
recorded lag (expected 0 samples) shows the stem shares the mix's timebase.
Sources: Demucs API (Separator, separate_tensor, shifts/overlap/split defaults)
  https://github.com/facebookresearch/demucs/blob/main/docs/api.md ;
  Rouard, Massa & Défossez (2022), Hybrid Transformers for Music Source Separation, arXiv:2211.08553 ;
  soundfile.write https://python-soundfile.readthedocs.io/en/latest/#soundfile.write
"""

import json  # sidecar
import logging  # progress
import time  # timing
from pathlib import Path  # paths

import numpy as np  # arrays

from analysis.timebase import xcorr_lag  # stem timebase check

log = logging.getLogger(__name__)  # module logger

LAG_CHECK_S = 60  # seconds of audio used for the lag check
MAX_LAG_S = 0.5  # search range of the lag check


def separate_vocals(audio: Path, out_dir: Path, model: str = "htdemucs") -> tuple[Path, dict]:
    """Local: (vocal-stem WAV path, sidecar dict); reuses the cache if present.
    Global: phase 1 of exp05."""
    wav_path, meta_path = out_dir / f"{audio.stem}_vocals.wav", out_dir / f"{audio.stem}_separation.json"  # cache
    if wav_path.exists() and meta_path.exists():
        log.info("Reusing vocal stem %s", wav_path)
        return wav_path, json.loads(meta_path.read_text(encoding="utf-8"))
    import random  # Demucs draws its time shifts with random.randint
    import librosa  # MP3 decoding + resampling
    import soundfile as sf  # WAV output
    import torch  # tensors
    from demucs.api import Separator  # Demucs high-level API
    random.seed(0)  # the shift is undone after inference, but seed it for bit-reproducibility
    torch.manual_seed(0)
    sep = Separator(model=model, device="cpu", shifts=1, overlap=0.25, split=True)  # pre-registered defaults
    wave, sr = librosa.load(audio, sr=sep.samplerate, mono=False)  # (2, n) float32 at 44.1 kHz
    t0 = time.perf_counter()
    mix, stems = sep.separate_tensor(torch.from_numpy(np.ascontiguousarray(wave)), sr)  # {"vocals": (2, n), ...}
    secs = time.perf_counter() - t0
    out_dir.mkdir(parents=True, exist_ok=True)
    sf.write(wav_path, stems["vocals"].numpy().T, sr)  # (n, 2) float -> 16-bit PCM WAV
    n = int(LAG_CHECK_S * sr)  # samples used for the lag check
    total = sum(stems.values())[:, :n].mean(0).numpy()  # mono sum of all stems
    lag = xcorr_lag(mix[:, :n].mean(0).numpy(), total, max_lag=int(MAX_LAG_S * sr))  # expected 0
    meta = {"model": model, "sources": list(stems), "samplerate": sr, "seconds": round(secs, 1),
            "shifts": 1, "overlap": 0.25, "split": True, "mix_vs_stem_sum_lag_samples": lag}
    meta_path.write_text(json.dumps(meta, indent=1), encoding="utf-8")
    log.info("Separated %s in %.1f s; mix vs sum-of-stems lag = %d samples", audio.name, secs, lag)
    return wav_path, meta
