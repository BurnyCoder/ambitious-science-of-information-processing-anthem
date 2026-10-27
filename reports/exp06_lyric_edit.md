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
