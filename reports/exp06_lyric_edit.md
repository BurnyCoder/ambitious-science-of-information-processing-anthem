# Experiment 06: re-singing one lyric line with Suno's replace-section

**Status: pre-registered.** Everything above "Results" was written and committed before the paid replace-section call. Results are appended below. Nothing above that heading is edited afterwards, except marked typo fixes.

## Background

The author asked that the word "mind" not appear in the lyrics. It occurred once, in Verse 1:

| | Line 5 (0-based, as in `timeline.json`) |
|---|---|
| before | And out of it a **mind** that learns to answer why. |
| after | And out of it a **thing** that learns to answer why. |

The replacement keeps the meter (one stressed syllable) and the *high / why* rhyme. `content/song.toml` now lists `banned_words = ["mind"]`, and `load_song_spec` refuses lyrics that contain it, before any paid call.

The released video (v1.1.0) sings the old word. Regenerating the whole song would have invalidated every per-take result (exp02 beats, exp03 alignment, exp05 onset offset). Instead, sunoapi.org's [Replace Music Section](https://docs.sunoapi.org/suno-api/replace-section) endpoint re-sings a time window of an existing take, and the docs say it blends with the parts before and after.
- The window must be ≥ 10 s and ≤ 50 % of the track.
- The docs don't say whether the result is the full track or only the segment.

## Method (fixed in advance)

- **Source take.** The take the pre-specified rule selects (max coverage, then min hootCer) is take 1, `89f89b1d…` of task `ecd1cfbc…`, the take in the video.
- **Window.** Lines 4–6 together, since lines 5–6 alone span only 7.6 s:
  - line 4: "Linear, then nonlinear, over and again,"
  - line 5: "And out of it a thing that learns to answer why."
  - line 6: "Nobody wrote its circuits, nobody drew the plan,"
  
  `song.infill_window` puts each edge in the middle of the gap between the last kept word and the first re-sung word. It uses Suno's word times shifted by the exp05 correction (`VIDEO_WORD_OFFSET_S = −0.137 s`), which gives **25.97–37.60 s (11.63 s)**. This was computed offline, before the call.
- **Request.** `uv run anthem --stage song --replace-lines 4 6` sends:
  - `prompt`/`lyrics`: the three lines.
  - `fullLyrics`: the whole new `content/lyrics.txt`.
  - `tags`, `title`, `negativeTags` and `vocalGender` from `content/song.toml`.
  
  The request is made once. If it fails, it is not retried automatically.
- **New take.** The pre-specified rule is applied to the returned takes. `song.json` records the parent task, take, window and lines.

## Checks and decision rules

| # | Check | Pass criterion | Decision attached |
|---|---|---|---|
| a | Full-length result | every returned take lasts within 1 s of 240.4 s (enforced in code; `song.json` stays unchanged otherwise) | if it fails, the edit is unusable; stop |
| b | Audio outside the window unchanged | decoding old and new MP3 at 16 kHz mono (`timebase.decode_ffmpeg`), the FFT cross-correlation lag (`timebase.xcorr_lag`, ±0.5 s) is \|lag\| ≤ 1 ms in both kept regions (0–24.97 s and 38.60 s–end), and the Pearson correlation of the aligned waveforms is ≥ 0.95 | b and c together decide whether the exp05 offset carries over |
| c | Suno's timings outside the window unchanged | median \|Δstart\| between new and old Suno word times (both repair v2) over written words that end before 24.97 s or start after 38.60 s is ≤ 0.02 s (less than one 33 ms frame) | if b and c pass, keep `VIDEO_WORD_OFFSET_S = −0.137`; if not, the offset is not carried over (exp05 must be re-run on the new take) and the render waits |
| d | The new word is sung, the old one is not | in faster-whisper `small.en` (same settings as exp03/exp05, full mix) words with start inside the window, "mind" is absent. Control: the old take's transcript of the same window, where "mind" is expected | if "mind" is still recognised, the edit failed |
| e | Karaoke alignment | coverage of the new take ≥ 0.99 with `align_words` (old take on the old lyrics: 1.0) | if it fails, inspect before rendering |

Descriptive only (no decision): whether Whisper recognises "thing" in the window; hootCer of the new takes; credits charged (balance before − after); and the median Suno − MMS onset difference inside the window (Demucs `htdemucs` + torchaudio `MMS_FA`, as in exp05, n ≈ 30 lead words), to see whether the re-sung part shows the same lag as exp05's −0.137 s calibration.

**What would falsify "the line was fixed with the rest of the song intact":** a failing a, b, d or e.

## Limitations known in advance

- No human listening test. Check d (an ASR model) is the only independent evidence about the sung word, and Whisper can mishear sung words. Hence the pass criterion is the absence of "mind", with "thing" only reported.
- The exp05 offset was calibrated on the old take. Inside the re-sung window it is only checked descriptively.

## Amendment 1 (written after the call, before checks b–e)

**What was seen.** The call (task `4a2ca040…`, 2 min 2 s, 6 credits: 987 → 981) returned two takes:
- `303ab1c3…`: 240.40 s. Its section tags sit at the original positions (Pre-Chorus 41.8 s), hootCer 0.148.
- `5c8aa2a0…`: 469.52 s. Suno's alignment shows the song running to the Outro at 264 s, then repeating from the Pre-Chorus to a second Outro at 443 s. hootCer 0.871.

Check a as written ("every returned take") therefore failed. The code refused to overwrite `song.json`, kept both files, and spent nothing more. Nothing other than these durations, the tag positions and the rule's scores below had been looked at.

**Amendment.** Check a is applied per take:
- A take that fails it is dropped and recorded under `dropped_takes` in `song.json`.
- The edit counts as unusable only if no take passes.

The intent of a was to catch a segment-only response, the ambiguity in the docs; a doubled song is a different failure that the rule did not anticipate. The amendment does not change which take is used: the pre-specified rule over both takes already picks `303ab1c3`, since coverage is 1.0 for both (the doubled take has 799 tokens) and hootCer is 0.148 vs 0.871. The already paid task was cached with `--resume-task`, which makes no new replace call.

## Amendment 2 (written after checks a–e, before the offset re-estimate)

**What was seen.**
- **Check b failed.** The new file lags the parent by a constant **−17.0 ms** (−272 samples at 16 kHz) in both kept regions and in 10 of the eleven 10 s blocks checked; the 20–30 s block, inside the changed zone, gave −257. Waveform r was 0.637 over 0–24.97 s and 0.962 over 38.6 s–end.
- **Suno changed more audio than the window.** Lag-aligned per-second correlation drops below 0.9 only from about 16 s to 46 s, so Suno regenerated about 10 s beyond each edge of the 25.97–37.60 s window.
- **The vocal timing kept its phrasing.** On every lead line from 2 to 11 (including the blend zone and the window), the median MMS onset on the new take is 0.01–0.02 s (one 20 ms MMS frame) earlier than on the parent.
- **Whisper recovers every written word** of lines 2–9 in 14–48 s, with one ASR slip ("to" → "the") and "thing" where the parent had "mind".
- **Suno's word times are copies.** Outside the window they are identical to the parent's (check c, median \|Δ\| = 0.000 s), so they now sit about 17 ms later relative to the audio than exp05 measured.
- **The lag grew to match.** Suno − MMS on the new take: +0.154 s outside the window and +0.157 s inside it (exp05 on the parent: +0.137 s).

**Pre-registered consequence.** The −0.137 s offset is not carried over; exp05 is re-run on the new take.

**Amendment: how exp05 is re-run.** No new blind hand labels are made; exp05's existing ones are reused. The steps:
1. exp05's primary metric δ = median(Suno − MMS) is computed on the new take, over lead words, with the line-cluster bootstrap (10 000 resamples, seed 0). The Demucs `htdemucs` + `MMS_FA` reference is computed exactly as in exp05.
2. exp05's 56 blind hand-labelled anchors are moved by the measured global lag. An anchor is kept only if the audio around it is the parent's:
   - the lag-aligned per-second r is ≥ 0.9 in its second and both neighbours;
   - the local cross-correlation lag in ±0.8 s around it is within 1 ms of the global lag;
   - the local r at that lag is ≥ 0.9.
3. exp05's `decide_offset` (D1–D4, unchanged) turns these into the offset.

The rationale for the transfer: where the new file is the parent audio shifted by a constant, a physical onset moves by exactly that constant. If the rule returns 0, or a basis other than `mms`, the render stops and this is reported.

## Results

Raw data: [`reports/data/exp06_lyric_edit.json`](data/exp06_lyric_edit.json). Script: `scripts/validate_lyric_edit.py`. Logs: `logs/run_20261027_202605.log` (the paid call), `logs/run_20261027_203059.log` (resume) and `logs/exp06_*.log`. Figure: [fig5](figures/fig5_lyric_edit.png).

![exp06: where the audio changed, and per-line Suno − MMS](figures/fig5_lyric_edit.png)

**Cost.** The balance read 987 before the call, 981 after it and 980 after the resume. The read is truncated to an integer by `SunoClient.credits()`, so each figure is ±1. The replacement, including two timestamped-lyrics fetches, therefore cost about 6 credits. The resume re-fetched both takes' timings for about 1 more: it skips the replace call, not the timing calls.

### Checks

| # | Check | Result | Pass |
|---|---|---|---|
| a | Full-length take | `303ab1c3` 240.40 s. `5c8aa2a0` (469.52 s) dropped per amendment 1 | yes (per take) |
| b | Kept audio unchanged | lag **−17.0 ms** in both regions. r = 0.637 (0–24.97 s), 0.962 (38.6–239.4 s). Lag-aligned per-second r < 0.9 exactly in seconds 16–46 | **no** |
| c | Suno's times outside the window | median \|Δ\| = 0.000 s, max 0.339 s, n = 401 words | yes |
| d | Sung word in the window (Whisper `small.en`) | new: "… and out of it a **thing** that learns to answer why …". Control (parent): "… and out of it are **mine** and learns …" | yes ("mind" absent; "thing" heard) |
| e | Alignment coverage | 1.0 (430/430, 2 repaired) | yes |

The control in d did not produce the literal token "mind": Whisper heard "mine". Its value as a positive control is therefore weaker than planned. Still, the parent's window has an /m/-initial word where the new take has "thing".

### Offset re-estimate (amendment 2: exp05's rule on the new take)

| | Parent take `89f89b1d` (exp05) | Edited take `303ab1c3` (exp06) |
|---|---|---|
| δ = median(Suno − MMS), 405 lead words, line-cluster 95 % CI | +0.137 s [0.125, 0.147] | **+0.156 s [0.144, 0.167]** |
| word-level bootstrap | — | [0.148, 0.162] |
| δ, MMS-confident words only (score ≥ 0.5) | — | +0.148 s [0.138, 0.160] (n = 193) |
| drift over the song (Spearman ρ, time vs d) | none | ρ = −0.02, p = 0.65 |
| δ inside / outside the window | — | +0.157 / +0.154 s |
| Whisper − MMS | −0.080 s | −0.080 s [−0.080, −0.070] |
| anchors used | 34 | 26 transferred: the 8 in seconds 16–46 failed the local check; the kept ones all have local lag −17.0 ms, r ≥ 0.952 |
| α_S = median(Suno − hand onset) | +0.220 s (+0.204 s on the same 26) | +0.221 s [0.162, 0.377] |
| β = median(MMS − hand onset) | +0.041 s (+0.041 s on the same 26) | +0.035 s [−0.011, 0.075] |
| D1–D4 | all true | all true |
| **Offset** | −0.137 s | **−0.156 s** (basis `mms`) |

The shift is accounted for. Suno's word times are copies of the parent's, but the new file plays 17 ms earlier, so Suno − MMS grows by 17–20 ms (MMS frames are 20 ms). On the same 26 anchors, α_S grows by 17 ms, and β, which compares two audio-derived onsets, stays within one MMS frame.

### Conclusions

- **Existence claim (causal intervention on one line).** A single replace-section call re-sang the targeted line, and an independent recogniser now hears "thing" there. Coverage, structure and tempo (129.2 BPM, 507 beats) were kept.
- **The hypothesis "the rest of the take is untouched" is falsified** as stated (check b). Suno regenerated about 46 − 16 = 30 s, not the requested 11.6 s: roughly 10 s of blending on each side. It also shifted the whole file by 17 ms. Inside the blend zone the vocal phrasing was kept (MMS onsets move by one frame on every line), and Whisper recovers the written lyrics there.
- **Suno's timestamped lyrics for an edited take are not re-measured outside the window.** They are byte-identical to the parent's even though the audio moved. Any per-take timing calibration must therefore be redone after an edit, which is what amendment 2 did.
- **Video.** It uses `303ab1c3` with `VIDEO_WORD_OFFSET_S = −0.156`.

### Learnings

- **Pre-specifying a duration check paid off,** but it assumed the failure mode in the docs (a segment-only response). The real failure was a 469.52 s take that sings the song twice. Checks on paid API output should test "is this the song?" per take, rather than all-or-nothing.
- **The window limit (≥ 10 s) forced re-singing three lines to change one word,** and Suno blends a further ~10 s on each side. A one-word edit costs ~30 s of regenerated audio.
- **Resuming should not re-fetch timings that are already on disk.** It cost about 1 credit here.
- **Waveform correlation needs the lag first.** The first per-second profile was computed at lag 0 and looked like the whole song had changed. A 17 ms shift decorrelates 16 kHz waveforms block by block. The script now aligns by the global lag before profiling.
