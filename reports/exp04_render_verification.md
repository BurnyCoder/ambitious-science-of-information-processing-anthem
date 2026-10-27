# Experiment 04: full render, automated verification and visual inspection

**Question.** Does the Remotion composition render the whole song into a valid 1080p30 video whose length equals the song? Does every scene read well at its own moment in the song?

**Pre-specified acceptance criteria** (implemented in [`verify.py`](../src/anthem/verify.py) before the full render):
- A video stream at 1920×1080, H.264, exactly 30 fps.
- An AAC audio stream.
- Container duration within 0.5 s of the song duration from `timeline.json`.
- A still from the middle of every section, each inspected by eye. Checks: is the text legible, does it collide with the lyric overlay, are the scenes in the right order, does the keyword-triggered content appear?

## Iteration 1: stills before the full render

`video/scripts/stills.mjs` rendered the midpoint of each of the 11 sections. Problems found, with the fix applied to each:

| Scene | Problem seen in the still | Cause | Fix |
|---|---|---|---|
| intro | Embedding-vector cells ran off the top of the frame | Vector anchored at y = 160 and spread ±225 px | Moved left (x = 300) and centred at y = 400; spacing 24 px |
| layers | "ReLU(z)=max(0,z)" label clipped | SVG 260 px wide | Widened to 460 px |
| landscape | One particle's trail zig-zagged | Step size too large where curvature is high (η = 0.9) | η = 0.5, plus step clipping to 0.6 units |
| ladder | Bottom rung and label collided with the lyric line | The ladder translated down as it "climbed" | Fixed ladder above the overlay; a glowing climber marker moves instead |
| atlas | Stars crowded into one band, then (after the first fix) overflowed onto caption and lyrics | Sung fields were all in one hemisphere of the Fibonacci sphere; projection scale | Index permutation (×7 mod 30); projection scaled to fit between caption and lyrics; network dims behind the closing statement |
| finale | "COUNTERFACTUAL," overflowed the frame; the formula's caption broke mid-word | Fixed font size; `word-break: break-all` on the whole panel | Font size fitted to word length (≤ 1650 px wide); break-all only on the bitstring; science panels moved to the lower half |

Chorus, manifolds, theory and outro needed no layout fixes. The re-rendered stills of the changed scenes were inspected again before the full render.

## Iteration 2: full render

Command (from `src/anthem/render.py`, logged in full): `npx remotion render src/index.ts Anthem out/anthem.mp4 --gl=angle --concurrency=8 --log=info`

There were three full renders: the first with repair v1 timings, the second with repair v2 (after exp03, released as v1.0.0), and the third with repair v2 plus the −0.137 s word offset decided by [exp05](exp05_onset_offset.md) (released as v1.1.0). The fourth uses the edited take from [exp06](exp06_lyric_edit.md) ("mind" replaced by "thing") with its re-estimated −0.156 s offset (released as v1.2.0).

| Render | Frames | Wall time | File size | Streams (ffprobe) | Duration (video / song) | Verify |
|---|---|---|---|---|---|---|
| 1 (v1 timings) | 7213 | 453.6 s | 223.4 MB | h264 1920×1080 30/1 + aac | 240.448 s / 240.42 s | **ok** |
| 2 (v2 timings, v1.0.0) | 7213 | 347.3 s | 217.6 MB | h264 1920×1080 30/1 + aac | 240.448 s / 240.42 s | **ok** |
| 3 (v2 + exp05 offset −0.137 s, v1.1.0) | 7213 | 485.0 s | 217.8 MB | h264 1920×1080 30/1 + aac | 240.448 s / 240.42 s | **ok** |
| 4 (edited take `303ab1c3` + exp06 offset −0.156 s, v1.2.0) | 7212 | 467.8 s | 218.0 MB | h264 1920×1080 30/1 + aac | 240.405 s / 240.41 s | **ok** |

- **Hardware.** A 16-thread Windows 11 desktop, Remotion 4.0.536, concurrency 8, ANGLE GL.
- **Log volume.** Render 1 logged one line per frame (about 14k lines), and its Remotion lines contained ANSI colour codes. Both were fixed before render 2: progress is logged every 5 %, and the codes are stripped (`render.keep_line`, `render.ANSI`). Render 2's run log shows 64 Remotion lines with no escape codes.
- **Benign warning.** Each tab printed `THREE.Clock: This module has been deprecated` once, from React Three Fiber's use of `THREE.Clock` with three 0.186. It does not affect output.
- **Visual check of the final file.** The 11 verification stills (`out/stills/verify_s*.png`, reproduced in [`figures/fig1_stills.png`](figures/fig1_stills.png) and `docs/img/`) show every scene in order and legible, with the karaoke line synchronised to the sung word at that moment. For example, the ladder's climber sits on "algorithms" while "Parameter components, algorithms, rung by rung" is sung.

## Learnings

- **Render stills before the full render.** A still pass of under a minute (11 frames) found six layout defects that a 6-minute render would only have revealed afterwards.
- **Measure render time on the same machine.** The second render was 24 % faster (347 s vs 454 s). Wall time varies with system load, so treat it as approximate.
- **Limitation.** Audio/video sync was verified structurally (one AAC stream, equal duration, frame-accurate `<Audio>` extraction by Remotion). It was not verified by perceptual playback inside this pipeline.
- **Audio timebase, measured afterwards ([exp05](exp05_onset_offset.md)).** Cross-correlating the first 60 s of the MP4's audio track (decoded by ffmpeg) with the librosa-decoded MP3 gives a lag of +11.0 ms (the video's audio is later) for both render 2 and render 3. That is a third of a frame. It is reported, not corrected. For render 4 against its own MP3 (the edited take) the same measurement gives +23.0 ms, under one frame; it is also reported, not corrected.
- **Render 3 spot check.** In the verse-1 still (section midpoint, t = 30.07 s), "And" is highlighted. Its hand-labelled onset is 29.77 s, Suno's raw onset is 30.12 s, and the shifted onset is 29.98 s. Without the offset, the word would still have been unlit in that frame.
- **Render 4 spot check.** The frame at t = 31.10 s of the final MP4 highlights "thing" in "And out of it a thing that learns to answer why." Its shifted onset is 31.04 s.
