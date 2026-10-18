"""Experiment 05: is the Suno-Whisper onset lag Suno's or Whisper's?

Local: for each take, separates the vocals (Demucs htdemucs), force-aligns the known lyrics on the
vocal stem (torchaudio MMS_FA), re-runs exp03's Whisper reference, and compares the onsets of the
words the video uses (Suno, repair v2) with both. On take 1 it also builds blinded panels of line
starts after a rest for hand labelling, then applies the pre-registered decision rule.
Global context: the karaoke and the scene cuts follow Suno's onsets; this decides whether the video
needs a global word-time offset (VIDEO_WORD_OFFSET_S). Pre-registration: reports/exp05_onset_offset.md.
Run 1 (no labels yet): computes all references, writes reports/figures/exp05_anchors/anchor_NN.png and
the hidden key out/exp05/anchor_key.json, then stops without comparing anything.
Run 2 (after reports/data/exp05_anchor_labels.json is written): compares, decides and writes
reports/data/exp05_onset_offset.json. Stems and model outputs are cached in out/exp05/.
Sources: see the analysis/ modules; Spearman correlation
  https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.spearmanr.html
Usage: uv run --group analysis python scripts/validate_onset_offset.py
"""

import json  # caches + raw results
import logging  # timestamped logs
import sys  # import path
from pathlib import Path  # paths

import numpy as np  # stats
from scipy import stats  # spearman

ROOT = Path(__file__).resolve().parents[1]  # repo root
sys.path.insert(0, str(ROOT / "src"))  # the pipeline package
from anthem.alignment import align_words  # the karaoke's own timings (repair v2)
from anthem.config import load_settings  # paths
from anthem.logging_setup import log_json, setup_logging  # terminal + file logs, full payloads
from anthem.lyrics import parse_lyrics  # written words
from anthem.song import load_cached_song, load_song_spec  # cached takes
from analysis.anchors import ALL_LINE_STARTS, resolve_labels, select_anchors, write_panels  # hand-labelled onsets
from analysis.decision import decide_offset  # pre-registered rule
from analysis.forced_alignment import mms_word_spans  # lyrics-aware reference
from analysis.references import match_pairs, whisper_words  # exp03 reference
from analysis.separation import separate_vocals  # vocal stem
from analysis.stats import cluster_median_ci, median_ci  # CIs
from analysis.timebase import decode_ffmpeg, xcorr_lag  # playback timebase

OUT = ROOT / "out" / "exp05"  # caches (gitignored)
DATA = ROOT / "reports" / "data"  # committed raw results
PANELS = ROOT / "reports" / "figures" / "exp05_anchors"  # committed blinded panels
LABELS = DATA / "exp05_anchor_labels.json"  # annotator's labels
KEY = OUT / "anchor_key.json"  # hidden panel key
N_BOOT = 10_000  # pre-registered resamples
log = logging.getLogger("exp05")  # stable logger name


def cached_json(path: Path, compute, title: str):
    """Local: load path if it exists, else compute, save and log the full output.  Global: model outputs run once."""
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    value = compute()
    path.write_text(json.dumps(value, indent=1), encoding="utf-8")
    log_json(log, title, value)  # complete model output in the run log
    return value


def take_records(take, sections) -> tuple[list[dict], dict, Path]:
    """Local: per written word: Suno (repair v2), MMS and Whisper onsets.  Global: phases 1-3 for one take."""
    aligned = json.loads(take.aligned_path.read_text(encoding="utf-8"))["alignedWords"]  # Suno timings
    suno, _ = align_words(sections, aligned)  # exactly what the video uses
    vocals, sep = separate_vocals(take.audio_path, OUT)  # phase 1: Demucs vocal stem
    stem = take.audio_path.stem
    mms = cached_json(OUT / f"{stem}_mms.json", lambda: mms_word_spans(vocals, [w.norm for w in suno]),
                      f"MMS_FA word spans ({take.id})")  # phase 2: forced alignment
    ref = cached_json(OUT / f"{stem}_whisper.json", lambda: whisper_words(take.audio_path),
                      f"Whisper words ({take.id})")  # phase 3: exp03's reference, re-run
    at = {i: ref[j]["start"] for i, j in match_pairs([w.norm for w in suno], [r["norm"] for r in ref])}  # matched
    rec = [{"i": i, "text": w.text, "norm": w.norm, "line": w.line_index, "section": w.section_index,
            "backing": w.backing, "suno": round(w.start, 4), "suno_end": round(w.end, 4), "mms": m["start"],
            "mms_end": m["end"], "mms_score": m["score"], "whisper": at.get(i)} for i, (w, m) in enumerate(zip(suno, mms))]
    return rec, sep, vocals


def signed(rec: list[dict], a: str, b: str, min_score: float = 0.0) -> tuple[np.ndarray, np.ndarray]:
    """Local: (a - b onsets, line ids) over lead words where both exist.  Global: the signed offsets."""
    rows = [r for r in rec if not r["backing"] and r[a] is not None and r[b] is not None and r["mms_score"] >= min_score]
    return np.array([r[a] - r[b] for r in rows]), np.array([r["line"] for r in rows])


def offset_stats(rec: list[dict], sections) -> dict:
    """Local: primary, secondary and sensitivity statistics for one take.  Global: phase 5 (compare)."""
    d, lines = signed(rec, "suno", "mms")  # primary: Suno - MMS
    delta = cluster_median_ci(d, lines, N_BOOT)
    dw, lw = signed(rec, "whisper", "mms")  # Whisper - MMS
    ds, ls = signed(rec, "suno", "whisper")  # Suno - Whisper (exp03, lead words only)
    dc, lc = signed(rec, "suno", "mms", min_score=0.5)  # confident MMS words only
    rng = np.random.default_rng(0)  # random-shift control, as in exp03
    t = np.array([r["suno"] for r in rec if not r["backing"]])  # onset times of the lead words
    by_sec = {}
    for r in rec:
        if not r["backing"]:
            by_sec.setdefault(r["section"], []).append(r["suno"] - r["mms"])
    rho = stats.spearmanr(t, d)  # drift of the lag over the song
    allw = [r["suno"] - r["whisper"] for r in rec if r["whisper"] is not None]  # all matched words, as in exp03
    return {
        "n_lead_words": int(len(d)), "n_lead_lines": int(len(set(lines))),
        "delta_suno_minus_mms": delta, "delta_word_bootstrap": median_ci(d, N_BOOT),
        "delta_mms_score_ge_0.5": {"n": int(len(dc)), "ci": cluster_median_ci(dc, lc, N_BOOT)},
        "whisper_minus_mms": {"n": int(len(dw)), "ci": cluster_median_ci(dw, lw, N_BOOT)},
        "suno_minus_whisper_lead": {"n": int(len(ds)), "ci": cluster_median_ci(ds, ls, N_BOOT)},
        "suno_minus_whisper_all_matched": {"n": len(allw), "median": float(np.median(allw))},  # reproduces exp03
        "abs_suno_mms": median_ci(np.abs(d), N_BOOT), "abs_whisper_mms": median_ci(np.abs(dw), N_BOOT),
        "abs_control_suno_shifted_mms": median_ci(np.abs(d + rng.uniform(-1, 1, len(d))), N_BOOT),
        "spread_around_delta": float(np.median(np.abs(d - delta[0]))),
        "share_within_1_frame": float(np.mean(np.abs(d) <= 1 / 30)), "share_within_0.1s": float(np.mean(np.abs(d) <= 0.1)),
        "share_suno_later": float(np.mean(d > 0)),
        "per_section": {sections[s].label + f" #{s}": {"n": len(v), "median": round(float(np.median(v)), 4)}
                        for s, v in sorted(by_sec.items())},
        "spearman_time_vs_delta": {"rho": float(rho.statistic), "p": float(rho.pvalue)},
        "mms_score_median": float(np.median([r["mms_score"] for r in rec])),
    }


def anchor_stats(rec: list[dict], key: list[dict], labels: dict, high: list[int]) -> dict:
    """Local: α_S, β, α_W over the usable hand-labelled anchors (and, post hoc, the high-confidence ones).
    Global: validation of the MMS reference."""
    times = resolve_labels(labels, key)  # unblinding
    rows = [{"panel": k["panel"], "text": rec[k["word_index"]]["text"], "anchor": times[k["panel"]],
             **{s: rec[k["word_index"]][s] for s in ("suno", "mms", "whisper")}} for k in key if times[k["panel"]] is not None]
    diff = lambda s, rs=rows: [r[s] - r["anchor"] for r in rs if r[s] is not None]  # noqa: E731  system - anchor
    hi = [r for r in rows if r["panel"] in high]  # POST-HOC: labels marked high-confidence at labelling time
    return {"n_panels": len(key), "n_usable": len(rows), "rows": rows,
            "alpha_suno": median_ci(diff("suno"), N_BOOT), "beta_mms": median_ci(diff("mms"), N_BOOT),
            "alpha_whisper": {"n": len(diff("whisper")), "ci": median_ci(diff("whisper"), N_BOOT)},
            "post_hoc_high_confidence": {"n": len(hi), "alpha_suno": median_ci(diff("suno", hi), N_BOOT),
                                         "beta_mms": median_ci(diff("mms", hi), N_BOOT),
                                         "alpha_whisper": median_ci(diff("whisper", hi), N_BOOT)}}


def playback_lags(take_mp3: Path, video: Path, sr: int = 22050, seconds: int = 60) -> dict:
    """Local: lags (ms) of ffmpeg's decoding of the MP3 and of the rendered MP4 vs librosa's decoding.
    Global: technical check 2 (the karaoke shares the analysed audio's timebase)."""
    import librosa  # the decoder all analyses use
    ref, _ = librosa.load(take_mp3, sr=sr, mono=True, duration=seconds)
    out = {}
    for name, path in (("ffmpeg_mp3", take_mp3), ("rendered_mp4", video)):
        if path.exists():
            sig = decode_ffmpeg(path, sr, seconds)
            out[name + "_lag_ms"] = round(1000 * xcorr_lag(ref, sig[:len(ref)], max_lag=sr // 2) / sr, 2)
    return out


def main() -> None:
    settings = load_settings(require_key=False)  # paths only
    log.info("Run log: %s", setup_logging(settings.logs_dir, prefix="exp05"))
    OUT.mkdir(parents=True, exist_ok=True)
    spec = load_song_spec(settings.content_dir)
    song = load_cached_song(settings, spec)  # no network
    sections = parse_lyrics(spec.lyrics)
    takes = {}
    for take in song.takes:  # phases 1-3
        rec, sep, vocals = take_records(take, sections)
        takes[take.id] = {"rec": rec, "separation": sep, "vocals": vocals, "mp3": take.audio_path}
    first = song.takes[0].id  # take 1, the one the video uses
    original = select_anchors(takes[first]["rec"])  # pre-registered rule (rest >= 0.8 s in both timings)
    anchors = select_anchors(takes[first]["rec"], **ALL_LINE_STARTS)  # phase 4: amendment 1, every lead line start
    log.info("Anchors: %d by the pre-registered rule, %d lead line starts panelled (amendment 1)", len(original), len(anchors))
    if not LABELS.exists():  # run 1: write blinded panels, compare nothing
        key = write_panels(takes[first]["vocals"], takes[first]["rec"], anchors, PANELS)
        KEY.write_text(json.dumps(key, indent=1), encoding="utf-8")  # hidden until labels exist
        log.info("Wrote %d blinded panels to %s. Label them in %s, then run again.", len(key), PANELS, LABELS)
        return
    key = json.loads(KEY.read_text(encoding="utf-8"))
    assert [k["word_index"] for k in key] == anchors, "anchor selection changed since the panels were made"
    labelled = json.loads(LABELS.read_text(encoding="utf-8"))  # committed before this phase ran
    labels = labelled["labels"]
    results = {tid: offset_stats(t["rec"], sections) for tid, t in takes.items()}  # phase 5: compare
    anc = anchor_stats(takes[first]["rec"], key, labels, labelled["confidence"]["high"])
    p = results[first]["delta_suno_minus_mms"]  # (median, lo, hi)
    decision = decide_offset(delta=p[0], delta_ci=p[1:], beta=anc["beta_mms"][0], n_anchors=anc["n_usable"],
                             alpha_s=anc["alpha_suno"][0], alpha_s_ci=anc["alpha_suno"][1:])  # phase 6: decide
    hypotheses = {"H_S_falsified": p[2] < 0.10, "H_W_falsified": p[1] > 0.05}  # pre-registered falsification
    timebase = {tid: {"mix_vs_stem_sum_lag_samples": t["separation"]["mix_vs_stem_sum_lag_samples"]} for tid, t in takes.items()}
    timebase[first].update(playback_lags(takes[first]["mp3"], settings.out_dir / "anthem.mp4"))
    summary = {"primary_take": first, "decision": decision, "hypotheses": hypotheses, "anchors": anc,
               "anchors_by_original_rule": original,
               "timebase": timebase, "takes": results}
    log_json(log, "Exp05 results", summary)
    out = DATA / "exp05_onset_offset.json"
    out.write_text(json.dumps({**summary, "anchor_key": key, "labels": labels,
                               "records": {tid: t["rec"] for tid, t in takes.items()},
                               "separation": {tid: t["separation"] for tid, t in takes.items()}}, indent=1), encoding="utf-8")
    log.info("Decision: offset %+.3f s (basis %s). Raw results: %s", decision["offset_s"], decision["basis"], out)


if __name__ == "__main__":
    main()
