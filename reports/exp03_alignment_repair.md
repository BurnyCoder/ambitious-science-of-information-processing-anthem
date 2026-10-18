# Experiment 03: word-timing quality and the repair step

**Question.**
- How closely do the word onsets used by the karaoke follow the singing?
- Does our repair rule, an intervention on Suno's timings, move words *closer* to where they are actually sung?

## Observed artifacts that motivated the repair

All of these come from inspecting `data/song/*/take*_aligned.json`, printed line by line in the session:

| Take | Artifact | Example |
|---|---|---|
| 1 | Intro backing vocals compressed into 0.7 s | "(Ooh, ooh, ooh) (We will know)" at 10.69–11.39 s |
| 1 | Mid-line word starting seconds early | "matrix" 11.73 → 19.47 s (7.74 s long); the next word "and" starts at 19.52 s |
| 2 | First line aligned twice | "A matrix and a bend, repeated without end," at 0.13–6.2 s **and** at 13.32 s (439 entries vs 431) |
| 2 | Mid-line words absurdly long | "bend," 0.66 → 6.17 s; "without" 2.62 s; "end," 3.05 s |
| both | Long line-final words | "know!" 6.66 s at the end of the chorus. Plausibly a real sustained note, so deliberately **not** repaired |

**Repair rule** (`alignment.repair_timings`). It walks each line backwards, so that chains of early words move together.
- **Gap rule.** If the silence before the next word *in the same line* exceeds 0.6 s, the word is moved to end at the next word's start. Its duration is kept, capped at 0.5 s.
- **Length rule.** Otherwise, if a mid-line word lasts longer than 1.2 s, its start is moved to 0.5 s before its end.
- **Thresholds.** 1.2 s is about 2.6 beats at 129 BPM, which is implausible for a single unsustained mid-line syllable. 0.5 s is about one beat.
- **Unit tests.** The thresholds were chosen before the validation below, and pinned by `tests/test_lyrics_alignment.py::test_repair_moves_too_early_mid_line_words_but_keeps_sustained_final_word`.
- **Effect.** It changes 29 of 430 words in take 1 and 23 of 430 in take 2.

## Pre-registered validation

Written in [`scripts/validate_alignment.py`](../scripts/validate_alignment.py) before running.

- **Reference.** faster-whisper (`small.en`, CPU int8, beam 5, `word_timestamps=True`) transcribes each take's full mix. It never sees our lyrics or Suno's timings, so its onsets are an *independent* (but noisy) measurement.
- **Matching.** Written words are matched to recognised words by normalised text (difflib, exact blocks only). Only matched pairs are scored.
- **H1.** Median |onset(repaired) − onset(Whisper)| ≤ 0.25 s, for each take.
- **H2.** On the words the repair changed (both takes pooled), |raw − Whisper| > |repaired − Whisper|. Tested with a paired one-sided Wilcoxon signed-rank test at α = 0.05.
- **Control.** Adding U(−1, 1) s random shifts to the repaired onsets must raise the median error. This shows the metric can detect misalignment.
- **Falsification.** H1 fails if the median exceeds 0.25 s. H2 fails if p ≥ 0.05 or the median paired improvement is ≤ 0.
- **Known limitations, stated in advance.**
  - Whisper's word timestamps come from cross-attention alignment and are not ground truth.
  - The input is sung vocals over a dense orchestral mix.
  - Only the subset of words Whisper recognises can be scored.
  - The number of repaired-and-matched words is small, which limits power.

## Results

See below. The numbers are the script's output, pasted verbatim.

### Run 1: repair v1 (pre-registered test)

Raw output: [`data/exp03_alignment_v1.json`](data/exp03_alignment_v1.json). Whisper `small.en` took 59 s and 51 s per take on CPU.

| Take | Whisper words | Matched pairs | Median \|Δ\| raw [95% CI] | Median \|Δ\| repaired v1 [95% CI] | Median \|Δ\| random-shift control | ≤ 0.25 s (repaired) | H1 |
|---|---|---|---|---|---|---|---|
| take 1 | 440 | 393 / 430 | 0.235 s [0.225, 0.248] | 0.242 s [0.227, 0.257] | 0.628 s [0.542, 0.673] | 53.4 % | **pass** |
| take 2 | 435 | 401 / 430 | 0.172 s [0.153, 0.190] | 0.179 s [0.158, 0.195] | 0.519 s [0.470, 0.577] | 65.1 % | **pass** |

- **H1 passes for both takes.** The control's median error is 2.6–2.9× larger, so the metric clearly detects misalignment.
- **H2 is falsified.** On the 43 repaired words that Whisper also recognised, v1 moved onsets *further* from the reference: median paired change −1.14 s, Wilcoxon one-sided p ≈ 1.0.

**Diagnosis**, from printing raw, repaired and Whisper onsets for each repaired word in take 1:
- v1's 1.2 s threshold flagged ordinary sung notes, e.g. "go" at 1.64 s in "So we go inside!".
- Shortening such a word created a gap, and v1's unconditional gap rule then dragged every earlier word of the line late: 27 words of take 1 moved 0.81–2.54 s later. Whisper and the raw timings agree on the true position (e.g. "But" raw 52.38 s, Whisper 52.18 s, v1 54.24 s).
- The one case v1 got right was "A matrix": raw 11.41/11.73 s (inside the intro), Whisper 17.74/18.54 s, v1 18.81/18.97 s.

### Repair v2 (post-hoc, designed after run 1)

- **Threshold.** Only mid-line words longer than **3.0 s** are treated as mis-placed. That is more than 6 beats at 129 BPM, far longer than any plausible unsustained mid-line syllable.
- **Chain.** A preceding word follows only if its successor was repaired, so a repair can no longer cascade from an ordinary long note.
- **Regression test.** `test_moderately_long_mid_line_word_does_not_cascade` pins the "go" case.
- **Status of the claims.** v2 was designed *after* seeing take 1's diagnostics, so any improvement on take 1 is a post-hoc observation, not a confirmed hypothesis.
- **No held-out test was possible.** The plan was to use take 2, which was not used in the design. But v2 repairs **0** words in take 2: its 5.5 s "bend," belongs to the duplicated first line, which the aligner leaves unmatched. With n = 0, no confirmatory test can be run. v2 repairs **2** words in take 1 ("A", "matrix").

### Run 2: repair v2 (descriptive)

Raw output: [`data/exp03_alignment.json`](data/exp03_alignment.json). Whisper output was identical across runs: the same 393/401 matched pairs.

| Take | Median \|Δ\| raw [95% CI] | Median \|Δ\| repaired v2 [95% CI] | Median \|Δ\| control | ≤ 0.1 s | ≤ 0.25 s | ≤ 0.5 s | H1 |
|---|---|---|---|---|---|---|---|
| take 1 (used in the video) | 0.235 s [0.225, 0.248] | 0.235 s [0.225, 0.248] | 0.590 s | 6.6 % | 56.2 % | 88.8 % | **pass** |
| take 2 | 0.172 s [0.153, 0.190] | 0.172 s (no repairs) | 0.500 s | 25.4 % | 67.8 % | 90.0 % | **pass** |

The two v2-repaired words both moved toward the reference: |Δ| went from 6.33 → 1.07 s for "A" and 6.81 → 0.43 s for "matrix". With n = 2 this is descriptive only; no test was run.

## Conclusions

- **What the karaoke now uses.** The video uses take 1 timings with repair v2. Over the 393 words Whisper also recognised, its onsets agree with an independent recogniser to a median of 0.235 s.
  - 56 % agree within 0.25 s and 89 % within 0.5 s.
  - Random ±1 s shifts roughly double to triple the disagreement, so the agreement is not an artifact of the metric.
- **How large that disagreement is.** 0.235 s is about half a beat, or 7 video frames. We cannot tell how much of it belongs to Suno and how much to Whisper. Whisper word timestamps on singing are known to be loose, so this is an upper bound on a mixture of both errors, not Suno's error.
- **What the failed repair taught us.** The pre-registered test falsified the first repair rule, which was plausible-looking but harmful. Without the test, 27 words of the video (take 1) would have lit up 0.8–2.5 s late. v2 is minimal: it only fixes the gross "matrix in the intro" artifact. It is post-hoc and validated only descriptively.
- **Next step for a stronger claim.** Repeat with a vocal-separated stem (e.g. Demucs), a forced aligner that is given the lyrics, and a few manually annotated onsets as ground truth.

### Post-hoc analysis: the disagreement is mostly a constant offset

The CDF in [`figures/fig3_alignment.png`](figures/fig3_alignment.png) rises late rather than from zero. So, after run 2, we also computed *signed* differences (Suno − Whisper onset). This is post-hoc; it was not pre-registered.

| Take | Median signed offset | Share of words with Suno later | Median \|d − median\| (spread after removing the offset) |
|---|---|---|---|
| take 1 | +0.234 s | 98.5 % | 0.075 s |
| take 2 | +0.165 s | 93.8 % | 0.089 s |

- **Interpretation.** The two time-stamping systems mostly differ by a near-constant lag of 0.17–0.23 s, and agree on *relative* timing to within about 0.08 s (2–3 video frames).
- **Which system is right cannot be decided from these data.** Whisper is reported to place word boundaries imprecisely (Bain et al., 2023, WhisperX), and a recogniser that absorbs preceding silence into a word would start it early. Alternatively, Suno may mark onsets late.
- **No correction was applied.** We do *not* shift the video's karaoke by 0.2 s, because doing so would encode an unvalidated assumption. A manually annotated subset of onsets would settle this.
