"""Figures for the reports and the technical report (paper).

Local: reads the raw experiment outputs in reports/data/ and the verification stills in out/stills/,
and writes PNG figures to reports/figures/:
  fig1_stills.png     one frame from the middle of each of the 11 sections (from the final MP4)
  fig2_beats.png      exp02: beat F-measure and |tempo error| vs true tempo, hop 256 vs 512 (clean clicks)
  fig3_alignment.png  exp03: CDF of |onset(Suno, repaired v2) - onset(Whisper)| per take, with the random-shift control
  fig4_onset_offset.png  exp05: signed onset differences vs the MMS forced aligner, plus hand-labelled anchors
  fig5_lyric_edit.png    exp06: where replace-section changed the audio, and per-line Suno - MMS on both takes
  fig6_exp07.png         exp07: released grokking run, its Fourier spectrum, induction scores, density v1.3.0 vs v1.2.0
  fig7_exp08.png         exp08: density v1.4.0 vs v1.3.0, hero share over the song, cards docked per section
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


def fig_exp07() -> None:
    """Local: exp07, (a) loss curves of the released grokking run with the paper's phases, (b) Fourier norms of its
    epoch-40k embedding with the paper's key frequencies, (c) ARENA's induction scores for GPT-2 small, (d) paired
    PNG-size log2 ratio v1.3.0 / v1.2.0 per sampled frame, sections shaded.
    Global: what the pre-specified checks of reports/exp07_provenance.md looked at."""
    vig = ROOT / "video" / "public" / "vignettes"  # card data written by scripts/vignette_data.py
    grok = json.loads((vig / "grokking.json").read_text(encoding="utf-8"))
    ind = json.loads((vig / "induction.json").read_text(encoding="utf-8"))
    dens_path = DATA / "exp07_density.json"
    fig, axes = plt.subplots(1, 4 if dens_path.exists() else 3, figsize=(17 if dens_path.exists() else 13, 3.6))
    a, b, c = axes[:3]
    for key, label, color in [("train", "train", "C4"), ("test", "test", "C1")]:
        e, v = np.array(grok[key]).T
        a.loglog(np.maximum(e, 1), v, color=color, label=label)
    for x0, x1, col in [(1, grok["phases"][0], "C3"), (grok["phases"][0], grok["phases"][1], "C1"), (grok["phases"][1], grok["phases"][2], "C2")]:
        a.axvspan(x0, x1, color=col, alpha=0.08)
    a.set(xlabel="epoch", ylabel="cross-entropy loss", title="released mainline run (Nanda et al. 2023)")
    a.legend(fontsize=8)
    i40 = grok["spectraEpochs"].index(40000)  # spectra are stored every 1,000 epochs
    norms = np.array(grok["spectra"][i40])  # the model analysed in the paper
    k = np.arange(1, len(norms) + 1)
    b.bar(k, norms, color=["C2" if kk in grok["keyFreqs"] else "C7" for kk in k])
    b.set(xlabel="frequency k", ylabel="‖W_E‖ along cos/sin(2πk·x/113)",
          title=f"epoch {grok['spectraEpochs'][i40]:,}: top-5 = {grok['top5At40k']}")
    im = c.imshow(np.array(ind["z"]), cmap="viridis", vmin=0, vmax=1, aspect="auto")
    for t in ind["top"]:
        l, h = map(int, t["head"].split("."))
        c.add_patch(plt.Rectangle((h - 0.5, l - 0.5), 1, 1, fill=False, ec="white", lw=1.5))
    c.set(xlabel="head", ylabel="layer", title="GPT-2 small induction scores (ARENA)")
    fig.colorbar(im, ax=c, fraction=0.046)
    if dens_path.exists():
        density_panel(axes[3], dens_path, "v1.3.0", "v1.2.0")
    fig.tight_layout()
    fig.savefig(FIG / "fig6_exp07.png", dpi=130)
    plt.close(fig)


def density_panel(ax, path: Path, new: str, old: str, margin: float | None = None) -> None:
    """Local: per-frame paired log2 PNG-size ratio with sections shaded, the median and its section-bootstrap CI in
    the title, and the non-inferiority margin if there is one.  Global: panel (d) of fig6 and panel (a) of fig7."""
    d = json.loads(path.read_text(encoding="utf-8"))
    r = np.log2(np.array(d["bytesNew"]) / np.array(d["bytesOld"]))
    sec, times = np.array(d["section"]), np.array(d["times"])
    for s in np.unique(sec):
        ax.axvspan(times[sec == s].min() - 1, times[sec == s].max() + 1, color=f"C{s % 10}", alpha=0.07)
    ax.plot(times, r, ".", ms=3, color="C0")
    ax.axhline(0, color="grey", lw=0.8)
    if margin is not None:
        ax.axhline(-margin, color="C3", lw=1, ls="--", label=f"non-inferiority margin −{margin}")
        ax.legend(fontsize=8, loc="lower right")
    lo, hi = d["ci95SectionBootstrap"]
    ax.set(xlabel="song time (s)", ylabel=f"log₂(PNG bytes {new} / {old})", title=f"{new} vs {old}: median {d['medianLog2Ratio']:+.2f} [{lo:+.2f}, {hi:+.2f}]")


def fig_exp08() -> None:
    """Local: exp08, (a) paired density v1.4.0 / v1.3.0 with the pre-specified margin, (b) max heroness over the song
    with the 0.5 threshold and sections shaded, (c) cards docked into a scene object per section.
    Global: what reports/exp08_integration.md tests and describes."""
    integ = json.loads((DATA / "exp08_integration.json").read_text(encoding="utf-8"))
    fig, (a, b, c) = plt.subplots(1, 3, figsize=(17, 3.6), gridspec_kw={"width_ratios": [1.2, 1.6, 1]})
    density_panel(a, DATA / "exp08_density.json", "v1.4.0", "v1.3.0", margin=0.10)
    t = np.arange(len(integ["heroSeries"])) * integ["seriesStepS"]
    starts = integ["sectionStarts"] + [t[-1]]
    for i in range(len(starts) - 1):
        b.axvspan(starts[i], starts[i + 1], color=f"C{i % 10}", alpha=0.07)
    b.plot(t, integ["heroSeries"], lw=0.7, color="C4")
    b.axhline(integ["heroOn"], color="grey", lw=0.8, ls="--")
    b.set(xlabel="song time (s)", ylabel="max heroness", ylim=(0, 1.05),
          title=f"a figure is hero {100 * integ['heroShareOfSungTime']:.0f} % of sung time; the scene alone {100 * integ['sceneOnlyShareOfSong']:.0f} % of the song")
    names = list(integ["cardsDockedPerSection"])
    c.barh(range(len(names)), list(integ["cardsDockedPerSection"].values()), color="C2")
    c.set_yticks(range(len(names)), [n.split(" ", 1)[1] for n in names], fontsize=8)
    c.invert_yaxis()
    c.set(xlabel="cards docked into a scene object", title=f"docks per section ({integ['cardsFlyingPast']} cards fly past instead)")
    fig.tight_layout()
    fig.savefig(FIG / "fig7_exp08.png", dpi=130)
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
    if (DATA / "exp07_checks.json").exists():  # written by scripts/vignette_data.py
        fig_exp07()
    if (DATA / "exp08_density.json").exists() and (DATA / "exp08_integration.json").exists():  # written by the exp08 scripts
        fig_exp08()
    print("figures written to", FIG)
