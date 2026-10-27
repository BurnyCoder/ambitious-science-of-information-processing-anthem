"""Experiment 06: did replace-section re-sing Verse 1 without "mind" and keep the rest of the take?

Local: compares the edited take (song.json) with its parent take (song.json "parent"):
(a) duration; (b) waveform lag and correlation outside the re-sung window; (c) Suno's word times outside it;
(d) Whisper's words inside it; (e) karaoke alignment coverage. Amendment 2 then re-runs exp05's decision
rule on the new take (Demucs + MMS_FA delta, exp05's blind anchors moved by the measured lag).
Global context: decides the word-time offset (VIDEO_WORD_OFFSET_S) for the edited take, which the video
then uses. Pre-registration and amendments: reports/exp06_lyric_edit.md.
Sources: analysis/ modules (exp05); numpy.corrcoef https://numpy.org/doc/stable/reference/generated/numpy.corrcoef.html
Usage: uv run --group analysis python scripts/validate_lyric_edit.py
"""

import json  # caches + raw results
import logging  # timestamped logs
import sys  # import path
from pathlib import Path  # paths

import numpy as np  # stats

ROOT = Path(__file__).resolve().parents[1]  # repo root
sys.path.insert(0, str(ROOT / "src"))  # the pipeline package
from anthem.alignment import align_words  # the karaoke's own timings (repair v2)
from anthem.config import load_settings  # paths
from anthem.logging_setup import log_json, setup_logging  # terminal + file logs, full payloads
from anthem.lyrics import parse_lyrics  # written words
from anthem.song import Take, load_cached_song, load_song_spec  # edited takes + parent record
from anthem.take_selection import select_take  # pre-specified rule
from anthem.timeline import shift_words  # exp05 correction -> audio time
from analysis.anchors import resolve_labels  # exp05 blind labels -> song time
from analysis.decision import decide_offset  # exp05's pre-registered rule, unchanged
from analysis.references import whisper_words  # exp03/exp05 reference
from analysis.timebase import decode_ffmpeg, xcorr_lag  # waveform lag
from validate_onset_offset import anchor_stats, cached_json, offset_stats, take_records  # exp05 phases

OUT = ROOT / "out" / "exp06"  # caches (gitignored)
EXP05 = ROOT / "out" / "exp05"  # the parent take's Whisper output, if exp05 ran here
DATA = ROOT / "reports" / "data"  # committed raw results
SR, MARGIN_S, MAX_LAG_S = 16000, 1.0, 0.5  # pre-registered decode rate, window margin, lag search range
ANCHOR_HALF_S, MIN_R = 0.8, 0.9  # amendment 2: local check around each transferred anchor
log = logging.getLogger("exp06")  # stable logger name


def parent_take(settings, data: dict) -> Take:
    """Local: rebuild the parent Take from the old task folder.  Global: the control side of every check."""
    task_dir = settings.song_dir / data["parent"]["task_id"]  # old generation folder (kept on disk)
    audio = next(task_dir.glob(f"take*_{data['parent']['take_id']}.mp3"))  # its MP3
    return Take(data["parent"]["take_id"], audio, None, audio.with_name(audio.stem + "_aligned.json"),
                None, None, None)


def lagged_r(old: np.ndarray, new: np.ndarray, i0: int, i1: int, lag: int) -> float:
    """Local: Pearson r of old[i0:i1] and new shifted by lag samples.  Global: "same audio?" at every scale."""
    return float(np.corrcoef(old[i0:i1], new[i0 + lag:i1 + lag])[0, 1])


def region_match(old: np.ndarray, new: np.ndarray, t0: float, t1: float) -> dict:
    """Local: lag (+ = new late) and Pearson r of the lag-aligned waveforms over [t0, t1] s.
    Global: check b, "the kept audio is the same audio on the same timebase"."""
    i0, i1, m = int(t0 * SR), int(t1 * SR), int(MAX_LAG_S * SR)  # samples
    lag = xcorr_lag(old[i0:i1], new[i0:i1], m)  # FFT cross-correlation
    return {"t0": round(t0, 2), "t1": round(t1, 2), "lag": lag, "lag_ms": round(1000 * lag / SR, 3),
            "r": round(lagged_r(old, new, i0 + m, i1 - m, lag), 5)}  # interior avoids edge effects


def per_second_r(old: np.ndarray, new: np.ndarray, lag: int) -> list[float | None]:
    """Local: lag-aligned r of old vs new in 1 s blocks (None where the shift leaves the file).
    Global: shows which seconds the replacement actually changed (figure + anchor filter)."""
    n = min(len(old), len(new)) // SR  # whole seconds in both
    return [round(lagged_r(old, new, k * SR, (k + 1) * SR, lag), 4) if k * SR + lag >= 0 and k < n - 1 else None
            for k in range(n)]


def transfer_anchors(key: list[dict], labels: dict, old: np.ndarray, new: np.ndarray, lag: int,
                     profile: list) -> tuple[list[dict], list[dict]]:
    """Local: exp05's anchor key moved by `lag`, keeping anchors whose surrounding audio is the parent's.
    Global: amendment 2, reusing exp05's blind hand labels on the edited take instead of relabelling."""
    times, kept, checks = resolve_labels(labels, key), [], []  # parent anchor times (song seconds)
    for k in key:
        t = times[k["panel"]]
        if t is None:  # ambiguous in exp05
            continue
        i0, i1 = int((t - ANCHOR_HALF_S) * SR), int((t + ANCHOR_HALF_S) * SR)  # ±0.8 s around the onset
        local = xcorr_lag(old[i0:i1], new[i0:i1], int(0.05 * SR))  # local lag, ±50 ms search
        r = lagged_r(old, new, i0, i1, local)  # local similarity at that lag
        secs = [profile[s] for s in (int(t) - 1, int(t), int(t) + 1) if 0 <= s < len(profile)]  # neighbours
        ok = all(v is not None and v >= MIN_R for v in secs) and abs(local - lag) <= SR // 1000 and r >= MIN_R
        checks.append({"panel": k["panel"], "anchor_s": t, "local_lag_ms": round(1000 * local / SR, 3),
                       "r": round(r, 4), "kept": ok})
        if ok:  # same audio, shifted: the onset moves by the global lag
            kept.append({**k, "window_start_s": round(k["window_start_s"] + lag / SR, 4)})
    return kept, checks


def whisper_in(take: Take, cache: Path, a: float, b: float) -> list[str]:
    """Local: Whisper's recognised words starting inside [a, b] s.  Global: check d (sung words)."""
    words = cached_json(cache, lambda: whisper_words(take.audio_path), f"Whisper words ({take.id})")  # full song
    return [w["norm"] for w in words if a <= w["start"] <= b]  # window only


def main() -> None:
    settings = load_settings(require_key=False)  # paths
    log.info("Run log: %s", setup_logging(settings.logs_dir, prefix="exp06"))
    OUT.mkdir(parents=True, exist_ok=True)
    spec = load_song_spec(settings.content_dir)  # new lyrics
    sections = parse_lyrics(spec.lyrics)  # written words (identical for both takes except "thing")
    data = json.loads((settings.song_dir / "song.json").read_text(encoding="utf-8"))  # edited song + parent
    song = load_cached_song(settings, spec)  # edited takes
    take, scores = select_take(song, sections)  # check e + the video's take
    old = parent_take(settings, data)  # control
    lines = data["parent"]["lines"]  # re-sung lines
    load = lambda t: align_words(sections, json.loads(t.aligned_path.read_text(encoding="utf-8"))["alignedWords"])[0]
    old_w, new_w = load(old), load(take)  # same written words, two takes
    exp05_offset = json.loads((DATA / "exp05_onset_offset.json").read_text(encoding="utf-8"))["decision"]["offset_s"]
    shifted = shift_words(old_w, exp05_offset)  # parent audio time, as the window was computed (-0.137 s)
    a, b = data["parent"]["infill_s"]  # window actually sent
    lo, hi = a - MARGIN_S, b + MARGIN_S  # kept regions end/start 1 s away from the window
    # (b) waveform lag + correlation in the kept regions
    old_pcm, new_pcm = decode_ffmpeg(old.audio_path, SR, 1e4), decode_ffmpeg(take.audio_path, SR, 1e4)  # whole files
    end = min(len(old_pcm), len(new_pcm)) / SR - MARGIN_S  # common length
    regions = [region_match(old_pcm, new_pcm, 0.0, lo), region_match(old_pcm, new_pcm, hi, end)]
    lag = regions[1]["lag"]  # the long kept region fixes the global lag
    profile = per_second_r(old_pcm, new_pcm, lag)
    # (c) Suno word starts outside the window, new - old
    keep = [i for i, w in enumerate(shifted) if w.end < lo or w.start > hi]  # by the parent's audio-time spans
    d = np.array([new_w[i].start - old_w[i].start for i in keep])  # raw Suno times; the offset cancels
    # (d) Whisper words inside the window, new take and control
    new_asr = whisper_in(take, OUT / f"{take.audio_path.stem}_whisper.json", a, b)
    old_cache = EXP05 / f"{old.audio_path.stem}_whisper.json"  # reuse exp05's run of the same model on the parent
    old_asr = whisper_in(old, old_cache if old_cache.exists() else OUT / f"{old.audio_path.stem}_whisper.json", a, b)
    # amendment 2: exp05's phases 1-6 on the new take, anchors transferred from the parent
    rec, _, _ = take_records(take, sections, OUT)  # Demucs + MMS_FA + Whisper (cached in out/exp06)
    sm = lambda idx: round(float(np.median([rec[i]["suno"] - rec[i]["mms"] for i in idx if not rec[i]["backing"]])), 4)
    labelled = json.loads((DATA / "exp05_anchor_labels.json").read_text(encoding="utf-8"))  # exp05's blind labels
    key05 = json.loads((DATA / "exp05_anchor_key.json").read_text(encoding="utf-8"))  # exp05's panel key
    key, transfer = transfer_anchors(key05, labelled["labels"], old_pcm, new_pcm, lag, profile)
    rerun = offset_stats(rec, sections)  # delta with the line-cluster CI, as exp05
    anc = anchor_stats(rec, key, labelled["labels"], labelled["confidence"]["high"])  # alpha_S, beta on kept anchors
    p = rerun["delta_suno_minus_mms"]  # (median, lo, hi)
    decision = decide_offset(delta=p[0], delta_ci=p[1:], beta=anc["beta_mms"][0], n_anchors=anc["n_usable"],
                             alpha_s=anc["alpha_suno"][0], alpha_s_ci=anc["alpha_suno"][1:])  # exp05's rule
    durations = {t.id: t.duration for t in song.takes}  # (a)
    result = {
        "parent": data["parent"], "task_id": song.task_id, "take_id": take.id, "take_scores": scores,
        "window_s": [a, b], "segment_words": [w.text for w in shifted if lines[0] <= w.line_index <= lines[1]],
        "a_durations": durations, "a_pass": all(abs((v or 0) - 240.4) <= 1.0 for v in durations.values()),
        "b_regions": regions, "b_pass": all(abs(r["lag_ms"]) <= 1.0 and r["r"] >= 0.95 for r in regions),
        "b_per_second_r": profile, "b_changed_seconds": [s for s, v in enumerate(profile) if v is not None and v < MIN_R],
        "c_n": len(d), "c_median_abs_s": round(float(np.median(np.abs(d))), 4),
        "c_median_signed_s": round(float(np.median(d)), 4), "c_max_abs_s": round(float(np.max(np.abs(d))), 4),
        "c_pass": bool(np.median(np.abs(d)) <= 0.02),
        "d_new_words": new_asr, "d_old_words": old_asr, "d_pass": "mind" not in new_asr,
        "d_thing_heard": "thing" in new_asr, "d_control_mind_heard": "mind" in old_asr,
        "e_coverage": next(s["coverage"] for s in scores if s["take_id"] == take.id),
        "suno_minus_mms_window_s": sm([i for i, w in enumerate(new_w) if lines[0] <= w.line_index <= lines[1]]),
        "suno_minus_mms_outside_s": sm(keep), "exp05_parent_delta_s": -exp05_offset,
        "amendment2": {"lag_samples": lag, "anchor_transfer": transfer, "offset_stats": rerun,
                       "anchors": {k: v for k, v in anc.items() if k != "rows"}, "decision": decision},
    }
    result["e_pass"] = result["e_coverage"] >= 0.99
    result["carry_offset"] = result["b_pass"] and result["c_pass"]  # pre-registered decision
    out = DATA / "exp06_lyric_edit.json"
    out.write_text(json.dumps({**result, "records": rec, "anchor_rows": anc["rows"]}, indent=1), encoding="utf-8")
    log_json(log, "exp06 result", {k: v for k, v in result.items() if k != "b_per_second_r"})  # full, minus profile
    log.info("Checks a-e: %s; carry exp05 offset: %s; amendment 2 offset %+.3f s (basis %s) -> %s",
             [result[f"{c}_pass"] for c in "abcde"], result["carry_offset"], decision["offset_s"],
             decision["basis"], out)


if __name__ == "__main__":
    main()
