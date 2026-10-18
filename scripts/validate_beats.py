"""Experiment 02: validate the beat tracker against synthetic click tracks with known beats.

Local: for tempos 70..180 BPM, two noise levels, two hop sizes and 5 noise seeds, synthesize
30 s click tracks, run anthem.audio_analysis.analyze_audio, and score tempo error and
beat F-measure (+-70 ms window) against the known beat times; prints a summary table with
95% t-intervals and writes the raw results to reports/data/exp02_beats.json.
Global context: grounds the beat times that drive the video's flashes and cuts in a
ground-truth test, and justifies hop=256 over librosa's default 512.
Pre-specified pass criterion (written before running): at hop 256 on clean clicks, every tempo
has |tempo error| <= 2 BPM and F-measure >= 0.95.
Sources: F-measure window 70 ms as in mir_eval.beat.f_measure
(https://mir-evaluation.github.io/mir_eval/#mir_eval.beat.f_measure); librosa.clicks
(https://librosa.org/doc/latest/generated/librosa.clicks.html); t-interval via scipy.stats.t.
Usage: uv run python scripts/validate_beats.py
"""

import json  # raw results
import sys  # import path for src/
import tempfile  # scratch WAVs
from pathlib import Path  # paths

import librosa  # click synthesis
import numpy as np  # math
import soundfile as sf  # WAV writing
from scipy import stats  # t-distribution for confidence intervals

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))  # use the package without installing
from anthem.audio_analysis import analyze_audio  # unit under test (the real pipeline code)

SR = 22050  # sample rate used by the pipeline
DUR = 30.0  # seconds per synthetic track
TEMPOS = list(range(70, 181, 10))  # BPM grid covering typical pop/anthem tempos
NOISES = {"clean": 0.001, "noisy": 0.05}  # white-noise std relative to unit-amplitude clicks
HOPS = [512, 256]  # librosa default vs pipeline choice
SEEDS = range(5)  # noise realizations per cell (power: see report)
WINDOW = 0.07  # +-70 ms hit window


def f_measure(est: np.ndarray, ref: np.ndarray, window: float = WINDOW) -> float:
    """Local: greedy one-to-one matching of estimated to reference beats within +-window.
    Global: standard beat-tracking accuracy (same window as mir_eval's default)."""
    used = np.zeros(len(ref), dtype=bool)  # reference beats already matched
    hits = 0  # true positives
    for e in est:  # each estimated beat
        d = np.abs(ref - e)  # distance to every reference beat
        d[used] = np.inf  # one-to-one
        j = int(np.argmin(d)) if len(ref) else -1  # closest unused reference
        if j >= 0 and d[j] <= window:
            used[j] = True
            hits += 1
    p = hits / len(est) if len(est) else 0.0  # precision
    r = hits / len(ref) if len(ref) else 0.0  # recall
    return 2 * p * r / (p + r) if p + r else 0.0  # harmonic mean


def ci95(x: list[float]) -> tuple[float, float]:
    """Local: mean and half-width of a 95% t-interval.  Global: error bars for the report table."""
    a = np.asarray(x, dtype=float)  # samples
    if len(a) < 2 or a.std(ddof=1) == 0:
        return float(a.mean()), 0.0  # no spread
    return float(a.mean()), float(stats.t.ppf(0.975, len(a) - 1) * a.std(ddof=1) / np.sqrt(len(a)))


def main() -> None:
    rows = []  # raw per-run results
    with tempfile.TemporaryDirectory() as tmp:  # scratch WAVs
        for tempo in TEMPOS:
            period = 60.0 / tempo  # seconds per beat
            ref = np.arange(period, DUR - 0.5, period)  # ground-truth beat times
            clicks = librosa.clicks(times=ref, sr=SR, length=int(DUR * SR))  # 1 kHz clicks
            for noise_name, noise in NOISES.items():
                for seed in SEEDS:
                    y = clicks + noise * np.random.default_rng(seed).standard_normal(len(clicks))  # seeded noise
                    path = Path(tmp) / f"c{tempo}_{noise_name}_{seed}.wav"
                    sf.write(path, y, SR)  # write WAV
                    for hop in HOPS:
                        a = analyze_audio(path, fps=30, hop=hop)  # the pipeline's own analysis
                        est = np.asarray(a.beat_times)
                        rows.append({"tempo": tempo, "noise": noise_name, "seed": seed, "hop": hop,
                                     "tempo_err_spacing": a.tempo_bpm - tempo, "tempo_err_tempogram": a.tempogram_bpm - tempo,
                                     # POST-HOC (added after run 1 showed both estimators are frame-quantized):
                                     "tempo_err_slope": (60.0 / np.polyfit(np.arange(len(est)), est, 1)[0] - tempo) if len(est) > 2 else None,
                                     "half_tempo": bool(abs(a.tempo_bpm - tempo / 2) < 3),  # metrical-level (octave) error
                                     "f": f_measure(est, ref),
                                     "median_abs_dev_ms": float(np.median([np.min(np.abs(ref - e)) for e in est]) * 1000) if len(est) else None})
    out = Path(__file__).resolve().parents[1] / "reports" / "data" / "exp02_beats.json"  # raw results
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rows, indent=1), encoding="utf-8")
    print("| hop | noise | tempo | tempo err (median spacing) | tempo err (tempogram) | tempo err (slope, post-hoc) | F(±70ms) | median abs dev ms |")
    print("|---|---|---|---|---|---|---|---|")
    for hop in HOPS:
        for noise_name in NOISES:
            for tempo in TEMPOS:
                cell = [r for r in rows if r["hop"] == hop and r["noise"] == noise_name and r["tempo"] == tempo]
                te, th = ci95([r["tempo_err_spacing"] for r in cell])
                ge, gh = ci95([r["tempo_err_tempogram"] for r in cell])
                se, sh = ci95([r["tempo_err_slope"] for r in cell])
                fe, fh = ci95([r["f"] for r in cell])
                md = np.mean([r["median_abs_dev_ms"] for r in cell])
                print(f"| {hop} | {noise_name} | {tempo} | {te:+.2f} ± {th:.2f} | {ge:+.2f} ± {gh:.2f} | {se:+.2f} ± {sh:.2f} | {fe:.3f} ± {fh:.3f} | {md:.1f} |")
    fails = sorted({(r["hop"], r["noise"], r["tempo"], "half-tempo" if r["half_tempo"] else "other") for r in rows
                    if abs(r["tempo_err_spacing"]) > 2 or r["f"] < 0.95})  # which cells fail, and how
    print("\nFailing cells (hop, noise, tempo, kind):", fails)
    passed = all(abs(r["tempo_err_spacing"]) <= 2 and r["f"] >= 0.95 for r in rows if r["hop"] == 256 and r["noise"] == "clean")
    print(f"\nPre-specified criterion (hop 256, clean: |tempo err| <= 2 BPM and F >= 0.95 for every run): {'PASS' if passed else 'FAIL'}")


if __name__ == "__main__":
    main()
