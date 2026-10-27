"""Figures for the reports and the technical report (paper).

Local: reads the raw experiment outputs in reports/data/ and the verification stills in out/stills/,
and writes PNG figures to reports/figures/:
  fig1_stills.png     one frame from the middle of each of the 11 sections (from the final MP4)
  fig2_beats.png      exp02: beat F-measure and |tempo error| vs true tempo, hop 256 vs 512 (clean clicks)
  fig3_alignment.png  exp03: CDF of |onset(Suno, repaired v2) - onset(Whisper)| per take, with the random-shift control
  fig4_onset_offset.png  exp05: signed onset differences vs the MMS forced aligner, plus hand-labelled anchors
  fig5_lyric_edit.png    exp06: where replace-section changed the audio, and per-line Suno - MMS on both takes
Global context: every number plotted is read from the committed raw data, so figures are reproducible.
Design notes (avoiding misleading plots): shared, labelled axes; log scale only where errors span 3 decades and it
is stated on the axis; half-tempo failures are marked explicitly instead of being clipped away.
Sources: matplotlib https://matplotlib.org/stable/api/pyplot_summary.html ,
         empirical CDF via numpy sort https://numpy.org/doc/stable/reference/generated/numpy.sort.html
Usage: uv run --group analysis python scripts/make_figures.py
"""

import json  # raw data
from pathlib import Path  # paths

import matplotlib  # plotting backend selection

matplotlib.use("Agg")  # file output only, no display needed
import matplotlib.pyplot as plt  # noqa: E402  plotting API
import numpy as np  # noqa: E402  arrays

ROOT = Path(__file__).resolve().parents[1]  # repo root
FIG = ROOT / "reports" / "figures"  # output dir
DATA = ROOT / "reports" / "data"  # raw experiment data


def fig_stills() -> None:
    """Local: 4x3 grid of section-midpoint stills.  Global: what each scene looks like in the final file."""
    paths = sorted((ROOT / "out" / "stills").glob("verify_s*.png"))  # 11 stills from verify.py
    fig, axes = plt.subplots(3, 4, figsize=(16, 7.2))  # 16:9 tiles
    for ax in axes.flat:
        ax.axis("off")  # no ticks on images
    for ax, p in zip(axes.flat, paths):
        ax.imshow(plt.imread(p))  # PNG -> array
        ax.set_title(p.stem.replace("verify_", "").replace("_", " "), fontsize=10)  # e.g. "s04 chorus"
    fig.tight_layout()
    fig.savefig(FIG / "fig1_stills.png", dpi=110)
    plt.close(fig)


def fig_beats() -> None:
    """Local: exp02 summary plot.  Global: shows the hop-size effect and the half-tempo failures."""
    rows = json.loads((DATA / "exp02_beats.json").read_text(encoding="utf-8"))  # per-run results
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
    for hop, marker in [(512, "s"), (256, "o")]:
        cell = [r for r in rows if r["hop"] == hop and r["noise"] == "clean"]  # clean condition
        tempos = sorted({r["tempo"] for r in cell})
        f = [np.mean([r["f"] for r in cell if r["tempo"] == t]) for t in tempos]  # mean over seeds (CI ~0)
        err = [np.mean([abs(r["tempo_err_spacing"]) for r in cell if r["tempo"] == t]) for t in tempos]
        half = [any(r["half_tempo"] for r in cell if r["tempo"] == t) for t in tempos]
        a1.plot(tempos, f, marker=marker, label=f"hop {hop}")
        a2.semilogy(tempos, err, marker=marker, label=f"hop {hop}")
        for t, e, h in zip(tempos, err, half):
            if h:  # left of the point at 170 BPM, below it at 180 BPM, so the two labels never overlap
                a2.annotate(f"half tempo (hop {hop})", (t, e), textcoords="offset points",
                            xytext=(-105, -3) if t < 180 else (-95, -16), fontsize=8)
    a1.axhline(0.95, color="grey", ls="--", lw=1, label="criterion F = 0.95")
    a1.set(xlabel="true tempo (BPM)", ylabel="beat F-measure (±70 ms)", ylim=(0.6, 1.02), title="Beat detection (clean clicks)")
    a2.axhline(2, color="grey", ls="--", lw=1, label="criterion 2 BPM")
    a2.set(xlabel="true tempo (BPM)", ylabel="|tempo error| (BPM, log scale)", title="Tempo error (median beat spacing)")
    a1.legend(fontsize=8)
    a2.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(FIG / "fig2_beats.png", dpi=130)
    plt.close(fig)


def fig_alignment() -> None:
    """Local: empirical CDFs of onset disagreement.  Global: how close karaoke timing is to an independent reference."""
    data = json.loads((DATA / "exp03_alignment.json").read_text(encoding="utf-8"))["takes"]  # per-take arrays
    fig, ax = plt.subplots(figsize=(6.5, 4))
    for (take_id, res), ls in zip(data.items(), ["-", "--"]):
        for key, label, color in [("errors_repaired", "Suno (repair v2)", "C0"), ("errors_control", "control: +U(−1,1) s", "C3")]:
            x = np.sort(np.asarray(res[key]))  # sorted errors
            ax.plot(x, np.arange(1, len(x) + 1) / len(x), ls=ls, color=color, label=f"take {take_id[:4]}: {label}")
    ax.axvline(0.25, color="grey", ls=":", lw=1, label="H1 threshold 0.25 s")
    ax.set(xlim=(0, 1.5), ylim=(0, 1), xlabel="|onset − Whisper onset| (s)", ylabel="fraction of matched words",
           title="Word-onset agreement with an independent recogniser")
    ax.legend(fontsize=7, loc="lower right")
    fig.tight_layout()
    fig.savefig(FIG / "fig3_alignment.png", dpi=130)
    plt.close(fig)


def fig_onset_offset() -> None:
    """Local: exp05 histograms of signed onset differences vs the MMS forced aligner, one panel per take, with
    the hand-labelled anchors of take 1 as a strip.  Global: shows which system carries the Suno-Whisper lag."""
    data = json.loads((DATA / "exp05_onset_offset.json").read_text(encoding="utf-8"))  # raw exp05 output
    bins = np.arange(-0.6, 0.8001, 0.02)  # 20 ms bins (one MMS frame)
    fig, axes = plt.subplots(1, len(data["records"]), figsize=(11, 5.6), sharex=True, sharey=True)  # same scales
    for k_take, (ax, (take_id, rec)) in enumerate(zip(axes, data["records"].items()), start=1):
        lead = [r for r in rec if not r["backing"]]  # primary population
        for a, label, color in [("suno", "Suno (repair v2) − MMS", "C0"), ("whisper", "Whisper − MMS", "C1")]:
            d = np.array([r[a] - r["mms"] for r in lead if r[a] is not None])  # signed differences
            out = int(np.sum((d < bins[0]) | (d > bins[-1])))  # outside the plotted range, reported in the legend
            ax.hist(np.clip(d, bins[0], bins[-1]), bins=bins, histtype="step", lw=1.5, color=color,
                    label=f"{label}: median {np.median(d):+.3f} s (n={len(d)}, {out} clipped to the edge)")
            ax.axvline(np.median(d), color=color, ls="--", lw=1)
        if take_id == data["primary_take"]:  # anchors exist only for the video's take
            rows = data["anchors"]["rows"]
            for k, (a, color) in enumerate([("suno", "C0"), ("mms", "C2"), ("whisper", "C1")]):
                d = [r[a] - r["anchor"] for r in rows if r[a] is not None]
                ax.plot(d, np.full(len(d), -3 - 3 * k), "|", ms=9, color=color, label=f"{a} − hand-labelled onset (n={len(d)})")
        ax.axvline(0, color="grey", lw=0.8)
        video = " (used in the video)" if take_id == data["primary_take"] else ""
        ax.set(xlabel="signed onset difference (s); > 0 = later than the reference", title=f"take {k_take}{video}",
               xlim=(-1.0, 0.85))  # anchors reach -0.98 s
        ax.legend(fontsize=7, loc="upper center", bbox_to_anchor=(0.5, -0.16))  # below the axes, never over the data
    axes[0].set_ylabel("lead words per 20 ms bin (strips below 0: anchors)")
    fig.tight_layout()
    fig.savefig(FIG / "fig4_onset_offset.png", dpi=130)
    plt.close(fig)


def fig_lyric_edit() -> None:
    """Local: exp06, (top) lag-aligned per-second waveform r between the parent and the edited take, with the
    requested window; (bottom) per-line median Suno - MMS onset on both takes.
    Global: where Suno's replace-section changed the audio, and why the word offset moved from -0.137 to -0.156 s."""
    e6 = json.loads((DATA / "exp06_lyric_edit.json").read_text(encoding="utf-8"))  # raw exp06 output
    e5 = json.loads((DATA / "exp05_onset_offset.json").read_text(encoding="utf-8"))  # parent's exp05 records
    fig, (top, bot) = plt.subplots(2, 1, figsize=(11, 6.4))
    r = np.array([np.nan if v is None else v for v in e6["b_per_second_r"]])  # None at the file edges
    top.plot(np.arange(len(r)) + 0.5, r, color="C0", lw=1)  # value at each second's centre
    top.axvspan(*e6["window_s"], color="C3", alpha=0.2, label="requested window (lines 4–6)")
    top.axhline(0.9, color="grey", ls="--", lw=0.8, label="r = 0.9 (anchor-transfer threshold)")
    top.set(xlabel="song time (s)", ylabel="Pearson r, 1 s blocks", ylim=(-0.4, 1.02), xlim=(0, len(r)),
            title=f"parent vs edited take, new file shifted by {e6['amendment2']['lag_samples'] / 16:.1f} ms")
    top.legend(fontsize=8, loc="lower right")
    for label, rec, color in [("parent take (exp05)", e5["records"][e5["primary_take"]], "C1"),
                              ("edited take (exp06)", e6["records"], "C0")]:
        lines = sorted({x["line"] for x in rec if not x["backing"]})  # lead lines
        med = np.array([np.median([x["suno"] - x["mms"] for x in rec if x["line"] == ln and not x["backing"]])
                        for ln in lines])  # per-line median
        song = np.median([x["suno"] - x["mms"] for x in rec if not x["backing"]])  # exp05's δ for this take
        out = int(np.sum((med > 0.48) | (med < -0.08)))  # MMS failures on single lines, e.g. a chorus start
        bot.plot(lines, np.clip(med, -0.08, 0.48), "o-", ms=3, lw=1, color=color,  # outliers drawn at the edge
                 label=f"{label}: song median {song:+.3f} s ({out} line(s) outside the axis, drawn at its edge)")
    first, last = e6["parent"]["lines"]
    bot.axvspan(first - 0.5, last + 0.5, color="C3", alpha=0.2, label="re-sung lines")
    bot.set(xlabel="lyric line (0-based)", ylabel="median Suno − MMS onset (s)", ylim=(-0.1, 0.5))
    bot.legend(fontsize=8, loc="upper right")
    fig.tight_layout()
    fig.savefig(FIG / "fig5_lyric_edit.png", dpi=130)
    plt.close(fig)


if __name__ == "__main__":
    FIG.mkdir(parents=True, exist_ok=True)  # reports/figures
    fig_stills()
    fig_beats()
    fig_alignment()
    if (DATA / "exp05_onset_offset.json").exists():  # written by scripts/validate_onset_offset.py
        fig_onset_offset()
    if (DATA / "exp06_lyric_edit.json").exists():  # written by scripts/validate_lyric_edit.py
        fig_lyric_edit()
    print("figures written to", FIG)
