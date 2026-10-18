"""Beat, downbeat and loudness analysis of the chosen take.

Local: loads the MP3 with librosa, tracks beats from the onset-strength envelope,
guesses downbeats (every 4th beat, phase chosen by onset strength), and samples
RMS loudness and onset strength once per video frame, normalized to 0..1.
Global context: beats trigger flashes and snap scene cuts; per-frame energy/onset
arrays let the Remotion scenes react to the music without decoding audio in the browser.
Sources:
- librosa.load / beat_track / onset_strength / feature.rms / frames_to_time:
  https://librosa.org/doc/latest/generated/librosa.beat.beat_track.html
  https://librosa.org/doc/latest/generated/librosa.onset.onset_strength.html
  https://librosa.org/doc/latest/generated/librosa.feature.rms.html
- beat tracking algorithm: Ellis (2007), "Beat Tracking by Dynamic Programming", J. New Music Research
- numpy.interp (resampling onto video frame times): https://numpy.org/doc/stable/reference/generated/numpy.interp.html
Downbeat choice is our heuristic (librosa has no downbeat tracker); it assumes 4/4.
"""

import logging  # analysis summary in the run log
from dataclasses import dataclass  # result record
from pathlib import Path  # input file

import librosa  # audio analysis
import numpy as np  # array math

log = logging.getLogger(__name__)  # module logger

SR = 22050  # librosa default sample rate; plenty for rhythm/loudness
HOP = 256  # ~11.6 ms frames; at the default 512 a 120 BPM click track was tracked with 22-frame (117.45 BPM)
#             steps and beats up to 33 ms off; at 256 beats land within 23 ms (< 1 video frame at 30 fps)


@dataclass(frozen=True)
class AudioAnalysis:
    """Local: rhythm + loudness summary.  Global: merged into timeline.json for the video."""

    duration_s: float  # exact audio length
    tempo_bpm: float  # tempo from the median beat spacing
    tempogram_bpm: float  # librosa's raw (lag-quantized) tempo estimate, kept for comparison
    beat_times: list[float]  # seconds
    downbeats: list[float]  # seconds, every 4th beat
    energy: list[float]  # RMS per video frame, 0..1
    onset: list[float]  # onset strength per video frame, 0..1


def _normalize(x: np.ndarray) -> np.ndarray:
    """Local: scale by the 99th percentile and clip to 0..1.  Global: robust to a single loud spike."""
    ref = np.percentile(x, 99) if x.size else 0.0  # robust maximum
    return np.clip(x / ref, 0.0, 1.0) if ref > 0 else np.zeros_like(x)  # silence -> zeros


def analyze_audio(path: Path, fps: int, hop: int = HOP) -> AudioAnalysis:
    """Local: run the full analysis on one audio file.  Global: phase "timeline" calls this on the chosen take."""
    y, sr = librosa.load(path, sr=SR, mono=True)  # decode + resample to mono 22.05 kHz
    duration = len(y) / sr  # seconds, exact from sample count
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)  # spectral flux novelty curve
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop, units="time")  # DP tracker
    raw_tempo = float(np.atleast_1d(tempo)[0])  # librosa returns a 1-element array
    # Both the tempogram estimate and the median beat spacing are quantized to whole frames (hop 512 @ 22.05 kHz:
    # 120 BPM sits between lag 21 = 123.0 and lag 22 = 117.45 BPM); hop 256 halves that error (reports/exp02).
    tempo = 60.0 / float(np.median(np.diff(beats))) if len(beats) > 1 else raw_tempo  # robust to a skipped beat
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]  # frame-wise loudness
    feat_t = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)  # feature frame centers
    onset_t = librosa.frames_to_time(np.arange(len(onset_env)), sr=sr, hop_length=hop)  # onset frame centers
    video_t = np.arange(int(round(duration * fps))) / fps  # one timestamp per video frame
    energy = _normalize(np.interp(video_t, feat_t, rms))  # RMS sampled at video frames
    onset = _normalize(np.interp(video_t, onset_t, onset_env))  # onset strength at video frames
    strength = np.interp(beats, onset_t, onset_env)  # how strong each beat is
    phase = int(np.argmax([strength[p::4].sum() for p in range(4)])) if len(beats) >= 4 else 0  # strongest 4/4 phase
    downbeats = beats[phase::4]  # every 4th beat from that phase
    log.info("Audio %s: %.2fs, tempo %.2f BPM (tempogram %.2f), %d beats, %d downbeats (phase %d)",
             Path(path).name, duration, tempo, raw_tempo, len(beats), len(downbeats), phase)
    return AudioAnalysis(duration, tempo, raw_tempo, [float(b) for b in beats], [float(b) for b in downbeats],
                         [float(v) for v in energy], [float(v) for v in onset])
