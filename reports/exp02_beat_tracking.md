# Experiment 02: beat tracker vs ground truth

**Question.** Are the beat times that drive the video's flashes and scene cuts accurate? Which analysis hop size should the pipeline use?

**Why it matters.** A beat placed 50–100 ms off is visible as a flash that misses the drum hit, because one video frame at 30 fps is 33 ms. The song itself has no ground-truth beat annotation, so we validate the *same code path* (`anthem.audio_analysis.analyze_audio`) on synthetic audio whose beats are known exactly.

## How the issue was found

The first unit test, `tests/test_audio_timeline.py::test_beat_tracker_recovers_known_tempo` (one 120 BPM click track, tolerance ±2 BPM, written before the implementation), **failed**:
- librosa's tempo estimate came back as **117.45 BPM**.
- Diagnosis: librosa's tempogram picks an integer autocorrelation lag. At hop 512 and 22.05 kHz the frame rate is 43.07 frames/s, so 120 BPM corresponds to a lag of 21.53 frames. Lag 22 gives 43.07 × 60 / 22 = 117.45 BPM, exactly the value returned.
- The dynamic-programming tracker then placed beats on a mostly 22-frame grid. Some beats were 33 ms off.
- Two candidate fixes were compared on that click track:
  - Hop 256 gives a tempo of 120.19 BPM, with every beat within 22.5 ms of a click.
  - Hop 128 gives 120.19 BPM, with beats within 16.7 ms.
- Hop 256 was chosen. It is under one video frame and half the cost of hop 128.
- Tempo is now reported as 60 / median(beat spacing) instead of the tempogram value.

## Systematic validation (this experiment)

**Design** ([`scripts/validate_beats.py`](../scripts/validate_beats.py); raw data in [`data/exp02_beats.json`](data/exp02_beats.json)):

| Factor | Levels |
|---|---|
| Tempo (BPM) | 70, 80, …, 180 (12 levels) |
| Noise (white, std relative to unit-amplitude clicks) | clean 0.001, noisy 0.05 |
| Hop size | 512 (librosa default), 256 (pipeline) |
| Noise seed | 0–4 (5 realisations per cell) |

- **Signal.** 30 s of 1 kHz clicks (`librosa.clicks`) at the true beat times, starting at one period.
- **Metrics.**
  - Tempo error, under both estimators.
  - Beat F-measure with a ±70 ms window (the default in `mir_eval.beat.f_measure`).
  - Median absolute deviation from the nearest true beat.
- **Error bars.** 95% t-intervals over the 5 seeds.
- **Pre-specified pass criterion** (written in the script header before running): at hop 256 on clean clicks, **every** run has |tempo error| ≤ 2 BPM and F ≥ 0.95.

## Results

See below. The table is the script's output, pasted verbatim.

Full table (script output, 48 cells): [`data/exp02_table.md`](data/exp02_table.md). Raw per-run data: [`data/exp02_beats.json`](data/exp02_beats.json). Total runtime is about 1 minute.

**Excerpt** (tempo error in BPM, F-measure at ±70 ms, mean ± 95% CI half-width over 5 noise seeds):

| Hop | Noise | Tempo | Error, median spacing | Error, tempogram | Error, slope (post-hoc) | F (±70 ms) | Median \|dev\| (ms) |
|---|---|---|---|---|---|---|---|
| 512 | clean | 120 | −2.55 ± 0.00 | −2.55 ± 0.00 | +0.00 ± 0.00 | 0.991 ± 0.000 | 21.8 |
| 512 | clean | 140 | +3.55 ± 0.00 | +3.55 ± 0.00 | −0.01 ± 0.00 | 0.993 ± 0.000 | 21.4 |
| 512 | clean | 180 | −90.90 ± 0.00 | −90.90 ± 0.00 | −90.00 ± 0.00 | 0.667 ± 0.000 | 21.0 |
| 256 | clean | 120 | +0.19 ± 0.00 | +0.19 ± 0.00 | +0.01 ± 0.00 | 1.000 ± 0.000 | 17.2 |
| 256 | clean | 130 | −0.80 ± 0.00 | −0.80 ± 0.00 | +0.00 ± 0.00 | 1.000 ± 0.000 | 16.9 |
| 256 | clean | 170 | **−85.28 ± 0.00** | −85.28 ± 0.00 | −85.00 ± 0.00 | **0.661 ± 0.000** | 18.7 |
| 256 | noisy | 170 | +2.27 ± 0.00 | +2.27 ± 0.00 | +0.00 ± 0.01 | 0.995 ± 0.006 | 25.1 |
| 256 | noisy | 180 | −89.33 ± 0.00 | −89.33 ± 0.00 | −90.00 ± 0.00 | 0.667 ± 0.000 | 24.2 |

**Pre-specified criterion: FAIL.** At hop 256 on clean clicks, 11 of the 12 tempos pass (70–160 and 180 BPM: |error| ≤ 2.00 BPM, F ≥ 0.999). 170 BPM fails.

**What the failures are**:
- **Half-tempo ("octave") errors.** The tracker locks onto every second click: 170 → 85 BPM at hop 256 clean, and 180 → 90 BPM at hop 512 and at hop 256 noisy. F ≈ 0.667 is the signature: precision 1, recall 0.5. This is the known metrical-level ambiguity of tempo estimation, made worse here by librosa's tempo prior centred near 120 BPM (`start_bpm=120`). It is not a timing-precision problem: the median deviation of the detected beats stays at 15–19 ms.
- **Frame quantization.** At hop 512 the error reaches ±3.55 BPM at 110, 120, 140 and 170 BPM. Both reported estimators, the tempogram and the median spacing, are locked to whole-frame periods; they give identical numbers in every cell. **This corrects an earlier claim in the code comments** that the median spacing is "sub-frame accurate". The improvement came from hop 256, not from the estimator.
- **Post-hoc observation.** A least-squares slope of beat time vs beat index removes the quantization: |error| ≤ 0.01 BPM wherever the metrical level is right. It was added after seeing run 1. The pipeline keeps the pre-specified median-spacing estimator, which is robust to a skipped beat. The tempo only appears as a HUD label; beat *times* are unaffected.

**Seeds and power.** Across the 5 noise seeds the tempo results had zero variance in every cell (CI ± 0.00), and the F-measure varied by at most ±0.021. Seeds are therefore not a meaningful source of variance for this component, and more seeds would not change any conclusion. A formal power analysis is moot when the between-seed SD is about 0.

**Timing precision.** The median deviation of detected beats from true clicks is 15–19 ms clean and 23–25 ms noisy at hop 256, against 21–23 ms and 29–33 ms at hop 512. All are below one video frame (33.3 ms).

## Implications for the song

- **Tempo.** On take 1, librosa tracks **506 beats**. The median spacing is 0.464 s, i.e. **129.31 BPM**; the post-hoc slope gives 130.68 BPM. There are no inter-beat gaps above 0.7 s, so no beats were skipped.
- **Validated range.** 129 BPM is inside the range where hop 256 passed every check.
- **Metrical level.** The song's metrical level cannot be checked against ground truth. However, Suno's own tag ("124 BPM") is near 129, not near 65 or 258, which argues against an octave error.
- **Caveat.** Real music is far harder than clicks: there are no isolated transients, and expressive tempo is possible. This experiment validates the *implementation and the hop choice*, not beat accuracy on this particular orchestral mix.

## Learnings

- **A failing first test was the most useful result.** Without the ±2 BPM unit test, the 117.45 BPM quantization would have gone unnoticed.
- **Report what the estimator really does.** We had described the median spacing as "sub-frame accurate", and the systematic run showed it is not. The comment and this report were corrected rather than the criterion being changed.
- **Fast songs need care.** For songs above about 165 BPM, set `start_bpm` near the expected tempo, or check for half-tempo results.
