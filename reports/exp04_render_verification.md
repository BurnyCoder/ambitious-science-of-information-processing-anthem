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

There were three full renders: the first with repair v1 timings, the second with repair v2 (after exp03, released as v1.0.0), and the third with repair v2 plus the −0.137 s word offset decided by [exp05](exp05_onset_offset.md) (released as v1.1.0). The fourth uses the edited take from [exp06](exp06_lyric_edit.md) ("mind" replaced by "thing") with its re-estimated −0.156 s offset (released as v1.2.0). The fifth and sixth add the illustration track of [exp07](exp07_provenance.md) (86 figure cards, real-data scene upgrades, punch zoom, cut glitch, equation dust and citation ticker). The fifth (before the fact-check corrections), the sixth (before two label fixes found in its card stills) and the seventh (before the code-review fixes of PR #9) were not released; the eighth is v1.3.0. The ninth and tenth stage the cards as hero shots inside the scenes ([exp08](exp08_integration.md)); the ninth was rendered before the code-review fixes of the v1.4.0 PR, and the tenth is v1.4.0. The eleventh puts the figures into their scenes' own layouts and adds the rewind. The twelfth adds the intro's flying layers after exp09's H4 failed, and is v1.5.0.

| Render | Frames | Wall time | File size | Streams (ffprobe) | Duration (video / song) | Verify |
|---|---|---|---|---|---|---|
| 1 (v1 timings) | 7213 | 453.6 s | 223.4 MB | h264 1920×1080 30/1 + aac | 240.448 s / 240.42 s | **ok** |
| 2 (v2 timings, v1.0.0) | 7213 | 347.3 s | 217.6 MB | h264 1920×1080 30/1 + aac | 240.448 s / 240.42 s | **ok** |
| 3 (v2 + exp05 offset −0.137 s, v1.1.0) | 7213 | 485.0 s | 217.8 MB | h264 1920×1080 30/1 + aac | 240.448 s / 240.42 s | **ok** |
| 4 (edited take `303ab1c3` + exp06 offset −0.156 s, v1.2.0) | 7212 | 467.8 s | 218.0 MB | h264 1920×1080 30/1 + aac | 240.405 s / 240.41 s | **ok** |
| 5 (illustration track, before the fact-check fixes; not released) | 7212 | 565.7 s | 244.4 MB | h264 1920×1080 30/1 + aac | 240.405 s / 240.41 s | **ok** |
| 6 (illustration track, fact-checked; not released) | 7212 | 517.3 s | 244.6 MB | h264 1920×1080 30/1 + aac | 240.405 s / 240.41 s | **ok** |
| 7 (illustration track, label fixes; not released) | 7212 | 531.4 s | 244.4 MB | h264 1920×1080 30/1 + aac | 240.405 s / 240.41 s | **ok** |
| 8 (illustration track + review fixes, v1.3.0) | 7212 | 441.3 s | 244.4 MB | h264 1920×1080 30/1 + aac | 240.405 s / 240.41 s | **ok** |
| 9 (hero shots + concrete scene layers; not released) | 7212 | 691.9 s | 263.0 MB | h264 1920×1080 30/1 + aac | not recorded (file replaced by render 10) / 240.41 s | **ok** |
| 10 (hero shots + review fixes, v1.4.0) | 7212 | 694.1 s | 263.6 MB | h264 1920×1080 30/1 + aac | 240.405 s / 240.41 s | **ok** |
| 11 (figures as part of their scenes + the rewind; not released) | 7212 | 659.0 s | 282.3 MB | h264 1920×1080 30/1 + aac | 240.405 s / 240.41 s | **ok** |
| 12 (+ the intro's flying layers, post hoc after exp09 H4; v1.5.0) | 7212 | 624.6 s | 285.3 MB | h264 1920×1080 30/1 + aac | 240.405 s / 240.41 s | **ok** |

- **Hardware.** A 16-thread Windows 11 desktop, Remotion 4.0.536, concurrency 8, ANGLE GL.
- **Log volume.** Render 1 logged one line per frame (about 14k lines), and its Remotion lines contained ANSI colour codes. Both were fixed before render 2: progress is logged every 5 %, and the codes are stripped (`render.keep_line`, `render.ANSI`). Render 2's run log shows 64 Remotion lines with no escape codes.
- **Benign warning.** Each tab printed `THREE.Clock: This module has been deprecated` once, from React Three Fiber's use of `THREE.Clock` with three 0.186. It does not affect output.
- **Visual check of the final file.** The 11 verification stills (`out/stills/verify_s*.png`, reproduced in [`figures/fig1_stills.png`](figures/fig1_stills.png) and `docs/img/`) show every scene in order and legible, with the karaoke line synchronised to the sung word at that moment. For example, the ladder's climber sits on "algorithms" while "Parameter components, algorithms, rung by rung" is sung.

## Iteration 3: the illustration track (v1.3.0)

Before the full render, `node scripts/stills.mjs --vignettes` rendered one still per figure card (86 stills), tiled into contact sheets and inspected by eye. Problems found and fixed:

| Problem seen | Fix |
|---|---|
| Attribution-graph node labels overlapped in the short chorus cards | Layout changed to x = layer rank, y = token lane, labels alternating above/below; edges curved and drawn with `evolvePath` |
| IOI head-class labels overlapped | Two-line labels |
| Backprop's forward and backward arrows were drawn on top of each other | Curved edges |
| Model labels collided on the parameter-scale scatter; "GPT-3 175B 175B" | Label repel; short display names |
| GPT-2 newline tokens showed as "Ċ" in the Neuronpedia contexts | Mapped to ⏎ |
| The superposition panels were too small to read | Figure fills the card height and scrolls panel by panel |
| The Othello probe bars started at 85 % (a truncated axis) | Bars on the full 0–100 % scale |
| The GPT-4 schematic curve left its axis | Function rescaled to stay within it |
| Scene captions collided with the corner cards; old theory pillars showed through the pillar cards | Captions the cards replace were removed; the theory scene was rebuilt around the cards |
| Equation dust was too strong near the lyrics in the finale | Opacity halved and kept above the lyric band |

After render 6, its card stills showed two remaining defects: overlapping rabbit-graph labels and a clipped WeightWatcher legend. Both were fixed with one shared label shortener and a two-line legend, then rendered again. The code review of PR #9 then changed four on-screen details (a chord-width floor, the Othello card's board now shows the real opening position instead of random pieces, the " know" token label, a fail-fast check for the chorus circuits), so the video was rendered once more. The 11 verification stills of render 8 show every scene in order, with the karaoke lit on the sung word and the cards in their slots. No error or warning lines appear in the run log of render 8.

## Iteration 4: hero shots inside the scenes (v1.4.0)

The cards no longer sit in boxes. Each one dives out of a scene object, is hero for at most 3.2 s, and docks back. The scenes gained concrete layers ([docs/scenes.md](../docs/scenes.md)). Stills were rendered per scene while each was rebuilt, then for every card at its hero moment (`stills.mjs --vignettes`, 86 stills) and for every section just before its end (`--docks`, 11 stills). All were tiled into contact sheets and inspected by eye. Problems found and fixed before the full render:

| Problem seen | Fix |
|---|---|
| The camera push (×1.15) cropped the theory title at the left edge | Push reduced to ×1.08, brightness 0.72 |
| Layer tunnel: attention arcs and the token-row label ran into the HUD; mile markers floated above the chips | Arcs flattened, the label moved into the left margin, markers moved onto the tunnel walls at the frame edges |
| Landscape: the grokking and double-descent ribbons and the saddle label projected above the top of the frame and under the hero | Ribbons moved onto side walls and lowered; labels became margin callouts with leader lines (x between 110 and 1810, outside the push's crop) |
| Landscape: the double-descent "train" label collided with the flat-minimum callout | Basin callouts moved down to y = 640 |
| Chorus: circuit node labels near the top reached the HUD once the camera pushed in; the prompt row sat close to the ticker | Node grid starts at y = 180; the row moved up to y = 958 |
| Finale: the program's caption collided with the citation ticker | Program and compression ratio on one line at y = 972 |
| Intro: the tokens card's caption overlapped the title's subtitle | The title dissolves as its own tokens emerge |

The code review of the branch then found a visible defect that stills cannot show. When one hero handed over to the next, the push origin jumped from one anchor to the other in a single frame. With the scale near 1.04–1.07 at that moment, the scene would jerk by up to about 70 px. The push origin is now the heroes' anchors averaged by heroness (`focusOf`, tested). The review also docked verse-3 cards by order rather than by direction, which is now fixed. Render 10 includes these fixes.

## Iteration 5: figures as part of their scenes, and the rewind (v1.5.0)

Each scene now places at most two panels in slots its layout reserves away from its key objects, and draws other figures itself. The outro became a flying rewind ([exp09](exp09_unified.md)).

**Checks.** Stills were rendered with a layout overlay (`stills.mjs --layout`, slots in cyan, protected regions in red, bands in yellow) while each scene was rebuilt, then for every card 1.6 s after it appears (82 stills) and every section end (11 stills).

**Problems found and fixed before the full render:**

| Problem seen | Fix |
|---|---|
| The intro title, split at its token boundaries, ran off both frame edges | Narrower split gap |
| The tokens card left its lower half empty | Token chips sized to fill the body |
| The open theory block left its lower half empty | Wider (720 px) and shorter blocks; the card scales to fill |
| Up to six atlas star plates grew at once and overlapped | At most two grown at once; older stars shrink back to their labels |
| The landscape's dive started on "inside", 1 s before the cut, so the curve-detector tiles barely appeared | The dive starts with its card, on "go" |
| The manifolds' R² label sat in the lyric band | Moved above the globe |
| The carbon/silicon/stars triptych bodies overflowed their columns | Each body drawn at its own proportions and scaled into its column |
| Two outro headline plates overlapped during the rewind | Only the newest plate is shown |
| gpt4 was assigned lane b in a scene with one slot | Caught by `tests/test_layout.py`; moved to lane a |

**Code review.** A rewind cut whose moment lies in the intro's first seconds could play forwards. The cut is now guarded and covered by a test. The review commit also un-exported unused ladder constants and replaced a constant-zero variable with its value.

Render 11 was bundled just before that commit. None of these changes alters a frame: on the real timeline every rewind moment lies after 14.7 s, so the guard never fires, and the other two changes do not change behaviour. Render 12, the v1.5.0 video, was bundled after all these commits. The run logs of renders 11 and 12 have no error or warning lines apart from the known `THREE.Clock` notice.

## Learnings

- **Render stills before the full render.** A still pass of under a minute (11 frames) found six layout defects that a 6-minute render would only have revealed afterwards.
- **Measure render time on the same machine.** The second render was 24 % faster (347 s vs 454 s). Wall time varies with system load, so treat it as approximate.
- **Limitation.** Audio/video sync was verified structurally (one AAC stream, equal duration, frame-accurate `<Audio>` extraction by Remotion). It was not verified by perceptual playback inside this pipeline.
- **Audio timebase, measured afterwards ([exp05](exp05_onset_offset.md)).** Cross-correlating the first 60 s of the MP4's audio track (decoded by ffmpeg) with the librosa-decoded MP3 gives a lag of +11.0 ms (the video's audio is later) for both render 2 and render 3. That is a third of a frame. It is reported, not corrected. For render 4 against its own MP3 (the edited take) the same measurement gives +23.0 ms, under one frame; it is also reported, not corrected.
- **Render 3 spot check.** In the verse-1 still (section midpoint, t = 30.07 s), "And" is highlighted. Its hand-labelled onset is 29.77 s, Suno's raw onset is 30.12 s, and the shifted onset is 29.98 s. Without the offset, the word would still have been unlit in that frame.
- **Render 4 spot check.** The frame at t = 31.10 s of the final MP4 highlights "thing" in "And out of it a thing that learns to answer why." Its shifted onset is 31.04 s.
