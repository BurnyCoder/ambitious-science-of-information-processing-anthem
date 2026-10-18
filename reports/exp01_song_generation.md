# Experiment 01: song generation and take selection

**Question.** Can one Suno V6 custom-mode generation, driven only by hand-written lyrics and a style string, produce a ~4-minute anthem? Does it come with word timings good enough to drive a karaoke-synced video?

**Pre-specified decisions**, fixed before the paid call (in [`content/`](../content), the plan, and [`take_selection.py`](../src/anthem/take_selection.py)):
- One generation only, i.e. one task that returns two takes. There is no re-rolling until a take "sounds best". This avoids an unbounded selection effect, at the cost of not optimising musical quality.
- Take-selection rule: maximise alignment coverage, then minimise `hootCer`.
- What gets reported: whether the takes satisfy the requested structure (duration, word timings present), the coverage, `hootCer`, and the counts of timing artifacts.

## Setup

| Item | Value |
|---|---|
| Provider / model | sunoapi.org, `model: "V6"`, `customMode: true`, `instrumental: false` |
| Lyrics | `content/lyrics.txt`: 2701 characters, 11 tagged sections, 58 lines, 430 words |
| Style | `content/song.toml`: "epic cinematic anthem, hybrid orchestral, massive choir, taiko and driving drums, soaring synth arpeggios, powerful male lead vocal with choir harmonies, triumphant, major key, 124 BPM, stadium singalong chorus, key change on final chorus, uplifting, awe, scientific wonder" (273 characters) |
| Negative tags / vocal gender | "lo-fi, mumbled vocals, comedic, sad, acoustic ballad" / `m` |
| Requested duration | 240 s |
| Run log | `logs/run_20261018_183346.log` (git-ignored; the facts below are copied from it) |

## Results

- **Credits and timing.** The balance was 1000 credits before the call. The task was submitted at 18:33:47.7. The status went `PENDING → TEXT_SUCCESS → SUCCESS`, and `SUCCESS` was observed at 18:34:49.5: **62 s** of wall time with 15-s polling. Downloads finished within about 4 s.
- **Output.** Two takes: take 1 lasts 240.40 s and take 2 lasts 239.92 s, both matching the requested 240 s. Each came with a cover image (JPEG) and word timings.
- **Style tags echoed back** by Suno (paraphrased style): both say "124 BPM", "key change into the final chorus", "massive choir", "taiko".

| Take | Suno alignedWords entries | Tokens after cleaning | Coverage (exact, success=true) | hootCer | Words repaired (v1 → v2, see exp03) |
|---|---|---|---|---|---|
| take 1 `89f89b1d…` | 431 | 430 | 430/430 = **1.000** | **0.1546** | 29 → 2 |
| take 2 `f16fd61b…` | 439 | 438 (one lyric line aligned twice) | 430/430 = 1.000 | 0.1646 | 23 → 0 |

- **Decision by rule: take 1.** Coverage tied at 1.0, so the tie-break decided (lower hootCer).
- **Coverage was not informative here.** Suno reported `success=true` for every entry, and all written words were found in both token streams. The tie-break therefore did all the work. hootCer is Suno's alignment-quality score, and its exact definition is undocumented, so a 0.010 difference is a weak basis for the choice. We report this honestly instead of claiming take 1 is better music. The selected take can be overridden with `--take`.

**Section boundaries found in take 1** (first sung word − 0.1 s, snapped to a beat):

| Section | Start (s) |
|---|---|
| Intro | 0.00 |
| Verse 1 | 18.60 |
| Pre-Chorus | 43.43 |
| Chorus | 57.44 |
| Verse 2 | 81.50 |
| Pre-Chorus | 104.05 |
| Chorus | 120.11 |
| Verse 3 | 141.21 |
| Bridge | 164.50 |
| Final Chorus | 196.77 |
| Outro | 213.97 |

The section order matches the written structure, and every section got sung words.

## Learnings

- **Duration must be requested explicitly.** The API default is 20 s. With `duration: 240` both takes landed within 0.5 s of the target.
- **Raw word timings are not karaoke-ready.**
  - Tags and line breaks are glued onto words.
  - One take aligned a line twice.
  - Several mid-line words get starts seconds too early.
  - This motivated the cleaning and repair steps; see [exp03](exp03_alignment_repair.md).
- **Suno's echoed "124 BPM" tag is not a measurement.** librosa measures about 129 BPM on take 1; see [exp02](exp02_beat_tracking.md). Use measured beats, never the prompt's tempo.
- **Limitations.**
  - One generation (n = 1 task, 2 takes). Nothing here supports a statistical claim about Suno's typical behaviour.
  - Musical quality was not assessed by listening in this pipeline. Only structural properties were measured.
