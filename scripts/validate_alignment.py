"""Experiment 03: validate Suno's word timings (raw vs repaired) against an independent reference.

Local: for each take, transcribe the full mix with faster-whisper (word timestamps), match the
recognized words to the written lyric words by normalized text (difflib), and compare word onsets
of (a) Suno raw alignment, (b) Suno + our repair step, (c) a random-shift control, against the
Whisper onsets. Writes raw results to reports/data/exp03_alignment.json and prints a summary.
Global context: the karaoke highlight and scene cuts use (b); this measures how well they track
the singing and whether the repair step (an intervention on the timings) helps.

Pre-registered hypotheses (written before running, also in reports/exp03_alignment_repair.md):
  H1: median |onset(repaired) - onset(whisper)| <= 0.25 s over matched words (each take).
  H2: on words changed by the repair, |raw - whisper| > |repaired - whisper| (paired, one-sided
      Wilcoxon signed-rank, alpha = 0.05, takes pooled).
  Control: adding U(-1, 1) s random shifts to the repaired onsets must raise the median error
      (shows the metric is sensitive to misalignment).
  Falsified if H1's median > 0.25 s, or H2's p >= 0.05 / median paired improvement <= 0.
Limitations: Whisper word timestamps on sung vocals over a full orchestral mix are themselves noisy
(the reference is not ground truth); n of repaired words is small (~50).
Sources: faster-whisper word_timestamps https://github.com/SYSTRAN/faster-whisper#word-level-timestamps ;
Wilcoxon signed-rank https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.wilcoxon.html ;
bootstrap CI https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html
Usage: uv run --group analysis python scripts/validate_alignment.py [model_size]
"""

import json  # raw results
import sys  # argv + import path
import time  # timing
from pathlib import Path  # paths

import numpy as np  # stats
from scipy import stats  # wilcoxon

ROOT = Path(__file__).resolve().parents[1]  # repo root
sys.path.insert(0, str(ROOT / "src"))  # import the pipeline package
from anthem.alignment import align_words  # the pipeline's own aligner
from anthem.config import load_settings  # paths
from anthem.lyrics import parse_lyrics  # written words
from anthem.song import load_cached_song, load_song_spec  # takes on disk
from analysis.references import match_pairs, whisper_words  # Whisper reference + text matching (shared with exp05)
from analysis.stats import median_ci  # bootstrap CI (shared with exp05)


def main() -> None:
    model_size = sys.argv[1] if len(sys.argv) > 1 else "small.en"  # Whisper model
    settings = load_settings(require_key=False)  # paths only
    spec = load_song_spec(settings.content_dir)  # lyrics
    song = load_cached_song(settings, spec)  # takes
    sections = parse_lyrics(spec.lyrics)  # written structure
    results, pooled_raw, pooled_rep = {}, [], []  # per-take results + repaired-word pairs
    rng = np.random.default_rng(0)  # control shifts
    for take in song.takes:
        aligned = json.loads(take.aligned_path.read_text(encoding="utf-8"))["alignedWords"]  # Suno timings
        raw, _ = align_words(sections, aligned, repair=False)  # (a)
        rep, stats_rep = align_words(sections, aligned, repair=True)  # (b)
        t0 = time.time()
        ref = whisper_words(take.audio_path, model_size)  # reference
        secs = time.time() - t0
        pairs = match_pairs([w.norm for w in rep], [r["norm"] for r in ref])  # exact text-match blocks
        e_raw = np.array([abs(raw[i].start - ref[j]["start"]) for i, j in pairs])  # |raw - ref|
        e_rep = np.array([abs(rep[i].start - ref[j]["start"]) for i, j in pairs])  # |repaired - ref|
        e_ctl = np.array([abs(rep[i].start + rng.uniform(-1, 1) - ref[j]["start"]) for i, j in pairs])  # control
        changed = [(i, j) for i, j in pairs if rep[i].repaired]  # words the repair moved
        pooled_raw += [abs(raw[i].start - ref[j]["start"]) for i, j in changed]
        pooled_rep += [abs(rep[i].start - ref[j]["start"]) for i, j in changed]
        results[take.id] = {
            "whisper_model": model_size, "whisper_seconds": round(secs, 1), "whisper_words": len(ref),
            "written_words": len(rep), "matched_pairs": len(pairs), "repaired_total": stats_rep["repaired"],
            "repaired_matched": len(changed),
            "median_ci_raw": median_ci(e_raw), "median_ci_repaired": median_ci(e_rep), "median_ci_control": median_ci(e_ctl),
            "within_0.1s_repaired": float(np.mean(e_rep <= 0.1)) if len(e_rep) else None,
            "within_0.25s_repaired": float(np.mean(e_rep <= 0.25)) if len(e_rep) else None,
            "within_0.5s_repaired": float(np.mean(e_rep <= 0.5)) if len(e_rep) else None,
            "H1_pass": bool(len(e_rep) and np.median(e_rep) <= 0.25),
            "errors_raw": e_raw.round(4).tolist(), "errors_repaired": e_rep.round(4).tolist(),  # per-word, for figures
            "errors_control": e_ctl.round(4).tolist(),
            # POST-HOC (added after the CDF showed a one-sided offset): signed repaired - Whisper onsets
            "errors_signed": [round(rep[i].start - ref[j]["start"], 4) for i, j in pairs],
        }
        sd = np.asarray(results[take.id]["errors_signed"])  # signed differences
        results[take.id]["signed_summary"] = {"median": float(np.median(sd)), "share_positive": float(np.mean(sd > 0)),
                                              "mad_around_median": float(np.median(np.abs(sd - np.median(sd))))}
        print(json.dumps({take.id: {k: v for k, v in results[take.id].items() if not k.startswith("errors_")}}, indent=1))
    d = np.array(pooled_raw) - np.array(pooled_rep)  # positive = repair helped
    w = stats.wilcoxon(d, alternative="greater") if len(d) >= 5 and np.any(d != 0) else None  # paired one-sided test
    summary = {"repaired_pairs": len(d), "median_improvement_s": float(np.median(d)) if len(d) else None,
               "wilcoxon_stat": float(w.statistic) if w else None, "p_value": float(w.pvalue) if w else None,
               "H2_pass": bool(w is not None and w.pvalue < 0.05 and np.median(d) > 0)}
    print(json.dumps(summary, indent=1))
    out = ROOT / "reports" / "data" / "exp03_alignment.json"  # raw results
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"takes": results, "repair_test": summary, "pairs_raw": pooled_raw, "pairs_repaired": pooled_rep},
                              indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
