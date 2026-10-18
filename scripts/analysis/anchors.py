"""Hand-labelled acoustic anchors: where the voice starts again after a rest.

Local: select_anchors picks line starts preceded by a rest in BOTH Suno's and MMS's timings;
write_panels plots a blinded 1.6 s window of the vocal stem around each (log-mel spectrogram, RMS,
onset strength, lettered librosa onsets) and returns the hidden key; resolve_labels turns the
annotator's letters back into song times.
Global context: exp05's check of the forced aligner's absolute timing. Neither Suno, MMS nor
Whisper positions are drawn, and the window centre is jittered, so a label cannot simply copy a
candidate (protocol in reports/exp05_onset_offset.md).
Sources: librosa onset_strength / onset_detect(backtrack=True)
  https://librosa.org/doc/latest/generated/librosa.onset.onset_detect.html ;
  melspectrogram / power_to_db https://librosa.org/doc/latest/generated/librosa.feature.melspectrogram.html ;
  matplotlib imshow extent https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.imshow.html
"""

import string  # panel letters
from pathlib import Path  # paths

import numpy as np  # arrays

GAP_S = 0.8  # rest before the line, required in both timings
MAX_ANCHORS = 20  # sample size cap
HALF_WINDOW_S = 0.8  # panel = 1.6 s
JITTER_S = 0.25  # hidden shift of the window centre
SR, HOP = 22050, 256  # exp02's validated onset resolution (11.6 ms)


def select_anchors(rec: list[dict], gap_s: float = GAP_S, max_n: int = MAX_ANCHORS, seed: int = 0) -> list[int]:
    """Local: indices of lead words that start a line after >= gap_s of silence in both Suno and MMS timings,
    at most max_n of them (seeded random sample, returned in song order).
    Global: a symmetric selection, so the anchor set favours neither system."""
    cand = [k for k in range(1, len(rec)) if rec[k]["line"] != rec[k - 1]["line"] and not rec[k]["backing"]
            and min(rec[k]["suno"] - rec[k - 1]["suno_end"], rec[k]["mms"] - rec[k - 1]["mms_end"]) >= gap_s]
    if len(cand) > max_n:  # pre-registered random subsample
        cand = sorted(int(c) for c in np.random.default_rng(seed).choice(cand, size=max_n, replace=False))
    return cand


def write_panels(vocals: Path, rec: list[dict], anchors: list[int], out_dir: Path, seed: int = 0) -> list[dict]:
    """Local: one PNG per anchor in out_dir; returns the hidden key (window start + onset times per panel).
    Global: what the annotator looks at; the key is only read after labelling."""
    import librosa  # features
    import matplotlib  # figures
    matplotlib.use("Agg")  # file output only
    import matplotlib.pyplot as plt
    y, _ = librosa.load(vocals, sr=SR, mono=True)  # vocal stem
    env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)  # spectral-flux onset envelope
    onsets = librosa.onset.onset_detect(onset_envelope=env, sr=SR, hop_length=HOP, backtrack=True, units="time")
    rms = librosa.amplitude_to_db(librosa.feature.rms(y=y, hop_length=HOP)[0], ref=np.max)  # dB re. stem peak
    mel = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=SR, hop_length=HOP, n_mels=96, fmax=8000), ref=np.max)
    t = librosa.times_like(env, sr=SR, hop_length=HOP)  # frame times
    rng = np.random.default_rng(seed)  # hidden jitter
    out_dir.mkdir(parents=True, exist_ok=True)
    key = []
    for n, k in enumerate(anchors, start=1):
        w0 = (rec[k]["suno"] + rec[k]["mms"]) / 2 + rng.uniform(-JITTER_S, JITTER_S) - HALF_WINDOW_S  # window start
        sel = (t >= w0) & (t < w0 + 2 * HALF_WINDOW_S)  # frames in the window
        rel = [round(float(o - w0), 4) for o in onsets if w0 <= o < w0 + 2 * HALF_WINDOW_S]  # lettered onsets
        fig, (a1, a2) = plt.subplots(2, 1, figsize=(10, 5.2), sharex=True, gridspec_kw={"height_ratios": [3, 2]})
        a1.imshow(mel[:, sel], origin="lower", aspect="auto", extent=[0, 2 * HALF_WINDOW_S, 0, 96], cmap="magma")
        a1.set_ylabel("mel band")
        a2.plot(t[sel] - w0, rms[sel], color="tab:blue", label="RMS (dB)")
        a2.set_ylabel("RMS dB")
        a3 = a2.twinx()  # onset strength on its own scale
        a3.plot(t[sel] - w0, env[sel], color="tab:orange", label="onset strength")
        for i, r in enumerate(rel):  # lettered candidate onsets
            for ax in (a1, a2):
                ax.axvline(r, color="cyan" if ax is a1 else "k", lw=1, ls="--")
            a1.text(r + 0.005, 88, string.ascii_uppercase[i], color="cyan", fontsize=13, weight="bold")
        a2.set_xticks(np.arange(0, 2 * HALF_WINDOW_S + 1e-9, 0.1))
        a2.grid(alpha=0.3)
        a2.set_xlabel("time in window (s)")
        a1.set_title(f"Anchor {n:02d}: first word of the line = '{rec[k]['text']}'  (vocal stem)")
        fig.tight_layout()
        fig.savefig(out_dir / f"anchor_{n:02d}.png", dpi=90)
        plt.close(fig)
        key.append({"panel": n, "word_index": k, "window_start_s": round(float(w0), 4), "onsets_rel_s": rel})
    return key


def resolve_labels(labels: dict[str, str], key: list[dict]) -> dict[int, float | None]:
    """Local: panel -> anchor time in song seconds (None = ambiguous).  Labels: a letter, "manual:<s>" or "ambiguous".
    Global: unblinding step; the only place labels meet song time."""
    out = {}
    for k in key:
        lab = labels[str(k["panel"])].strip()  # every panel must be labelled
        if lab.lower() == "ambiguous":
            out[k["panel"]] = None
        elif lab.lower().startswith("manual:"):  # annotator's own time in the window
            out[k["panel"]] = round(k["window_start_s"] + float(lab.split(":", 1)[1]), 4)
        else:  # a lettered detector onset
            out[k["panel"]] = round(k["window_start_s"] + k["onsets_rel_s"][string.ascii_uppercase.index(lab.upper())], 4)
    return out
