"""Check that two decodings of the same audio share one timebase.

Local: xcorr_lag finds the integer sample lag that best aligns two signals (FFT cross-correlation);
decode_ffmpeg decodes any file's audio track to mono float32 with ffmpeg.
Global context: exp05 compares onsets measured on a Demucs stem, on the librosa-decoded MP3 and,
implicitly, the audio track Remotion muxed into out/anthem.mp4. A constant lag between those
decodings would shift every word on screen, so it is measured instead of assumed to be 0.
Sources: scipy.signal.correlate / correlation_lags
  https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.correlation_lags.html ;
  ffmpeg raw f32le output https://trac.ffmpeg.org/wiki/audio%20types
"""

import subprocess  # ffmpeg
from pathlib import Path  # paths

import numpy as np  # arrays
from scipy import signal  # cross-correlation


def xcorr_lag(ref: np.ndarray, sig: np.ndarray, max_lag: int) -> int:
    """Local: lag k (samples, |k| <= max_lag) maximising sum ref[n] * sig[n + k]; positive = sig is late.
    Global: the timebase offset between two decodings / a mix and its stems."""
    corr = signal.correlate(sig, ref, mode="full", method="fft")  # correlation at every lag
    lags = signal.correlation_lags(len(sig), len(ref), mode="full")  # lag of each correlation value
    keep = np.abs(lags) <= max_lag  # only plausible lags
    return int(lags[keep][np.argmax(corr[keep])])  # best lag


def decode_ffmpeg(path: Path, sr: int, seconds: float) -> np.ndarray:
    """Local: first `seconds` of the file's audio as mono float32 at `sr`.  Global: how a video player decodes it."""
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-t", str(seconds), "-vn", "-ac", "1",
                          "-ar", str(sr), "-f", "f32le", "-"], check=True, capture_output=True)  # raw samples
    return np.frombuffer(out.stdout, dtype=np.float32)  # bytes -> array
