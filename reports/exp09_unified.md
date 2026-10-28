# Experiment 09: figures that are part of the scenes, and a rewind finale (v1.5.0)

**Question.** v1.4.0 staged each figure card as a hero at the centre of the frame. The scene behind it was pushed in and dimmed. After watching v1.4.0, the author reported these problems:
- **0:14:** an empty stretch.
- **1:22:** the ladder hidden behind the cards.
- **1:52:** figures shown too briefly.
- **2:25:** "limits" appearing late and only briefly.
- **2:24:** theory parts that should fit into the screen blocks.
- **3:09:** green formulas covering the amber closing statement.

Overall the figures and the main video looked like "two overlapped independent videos".

v1.5.0 makes each scene own its figures:
- at most two panel slots per scene, placed in the scene's own layout and wired to the object they explain;
- figures drawn by the scene itself, in place;
- no global push or dim;
- no figure stealing another's slot.

The figures were curated to fit; every change is listed below with its reason. The outro becomes a flying rewind through the whole video.

## Pre-specified checks

These are fixed in the approved plan and in this file **before** any v1.5.0 render or comparison is run.

- **H1, dwell.** Every panel card (lanes a/b) is visible for ≥ 3.0 s. A card triggered within 3 s of its section's cut runs to the cut and must be visible for ≥ 2.5 s. Source: `timeline.json`, checked by pytest.
- **H2, concurrency.** At most 2 panel cards are active at once in any section.
- **H3, no cover.** The rectangle of every panel slot has zero overlap with:
  - its scene's protected regions (the ladder, the landscape surface centre and the SGD swarm, the tunnel's vanishing point, the circuit network centre, the manifold clouds, the theory blocks, the atlas sphere, the halo, the closing statement);
  - the HUD band;
  - the lyric or giant-word band.

  Source: `video/src/stage/layout.json`, checked by `tests/test_layout.py`.
- **H4, the 0:14 gap is filled.** Frames are sampled at 13, 14, …, 18 s, PNG-encoded, and paired with the same timestamps of v1.3.0, which had no gap. The median log₂(bytes v1.5.0 / bytes v1.3.0) must be ≥ 0.
- **H5, detail kept.** Paired frames every 2 s against v1.4.0. The section-bootstrap 95 % CI lower bound of the median log₂(bytes v1.5.0 / bytes v1.4.0) must be > −0.10, the margin of exp08 ([Piaggio et al. 2012](https://doi.org/10.1001/jama.2012.87802)).
  - The outro (from 213.96 s) is excluded from this primary test, because the rewind replaces its content entirely.
  - Its numbers, and every section's, are reported descriptively.
- **H0, render verification.** Unchanged criteria ([exp04](exp04_render_verification.md)).
- **Also:** every sung line still has a figure (coverage 1.0, as in exp07).

**What would count against the change:**
- any H0–H3 failure;
- the intro window still sparser than v1.3.0 (H4 < 0);
- a CI lower bound ≤ −0.10 in H5.

**Descriptive, not tested:**
- the seconds each figure is visible, against v1.4.0's hero seconds;
- the share of time a figure covers a key scene object, v1.4.0 against v1.5.0.

**Baselines.**
- **v1.4.0:** `out/v1.4.0/we-will-know-anthem.mp4`, sha256 `fe18ea18…0b61`. This equals the digest GitHub lists for the [v1.4.0 asset](https://github.com/BurnyCoder/ambitious-science-of-information-processing-anthem/releases/tag/v1.4.0).
- **v1.3.0:** `out/v1.3.0/we-will-know-anthem.mp4`, sha256 `3ecb6371…4c60`.

## Curation log

**Method.** A two-slot simulation was run on v1.4.0's card start times. It listed the cards that would get under 3 s if each scene had only two panel slots. For each such card, the first applicable fix was taken, in this order:
1. an earlier word of the same line;
2. the scene draws the card itself (lane `scene`);
3. a merge;
4. a drop.

Lanes a/b were then assigned greedily: each new panel takes the slot that has been free longest.

**Result.** 86 → 82 cards: 50 panels and 32 drawn by their scenes. Line coverage stays 1.0.

| Card(s) | Change | Why |
|---|---|---|
| nngp "Tractable limits" | Trigger `^infinity$` → `^limits$`; now 144.6 s instead of 146.9 s | "Limits" opens the line; the old trigger was its last word |
| "Nobody drew the plan" (Sutton's Bitter Lesson) | Lane `scene`: text on the tunnel wall | Third card within 3 s of verse 1's circuits line |
| shoggoth "The drives behind the face" | Lane `scene`: mask behind the ladder's top rung | Decisions, behaviors and drives are sung within 1.8 s |
| encyclopedia | Stays a panel (slot a, after refusal) next to the book, which files the rung figures | First made `scene`; with slot a free after 98 s, a readable panel was better (refusal still gets 4.2 s) |
| graphRabbit (verse 2) | Dropped | 1.3 s before the cut. The rhyme-planning graph is listed in the encyclopedia and lit in chorus 2's circuits |
| curves | Lane `scene`: the tiles the landscape's "inside" dive ends in | Replaces a schematic card with the scene's own dive |
| functionVector, truth, "the bigger they get" | Lane `scene`, timed by their cards: antonym stream, true/false split, Llama-2 R² steps | The scene already draws them; five cards in 5 s |
| polysemantic (schematic) | Dropped | Superposition covers the same line with released data |
| The five theory directions | Lane `scene`: drawn inside the theory blocks | The author asked for them to fit into the screen blocks |
| 15 bridge formulas, "One science of information" | Lane `scene`: star chips; the closing card becomes the statement's subtitle | 21 cards in 32 s; the statement must be the highlight |
| neuronIcon, chip, hydrogen | Merged into `substrates`, one panel revealed word by word | Sung within 2.7 s |
| (bridge) | `[[clear]]` at "science" | Earlier cards leave before "ONE SCIENCE OF INFORMATION" |
| kProgram | Lane `scene`: the finale's bit rain collapsing into the program | The scene already shows it |
| "Intentional design" | Lane `scene`, triggered on the first word of its line; a closing banner | Its line straddles the cut; it was 0.28 s |
| The four outro cards | Lane `scene`: headline plates of the rewind | The outro becomes the rewind |

## Results

Raw data:
- [`data/exp09_unified_render11.json`](data/exp09_unified_render11.json) and [`data/exp09_density_render11.json`](data/exp09_density_render11.json): the pre-registered run, render 11.
- [`data/exp09_unified.json`](data/exp09_unified.json) and [`data/exp09_density.json`](data/exp09_density.json): the final video, render 12.
- [`data/exp09_v140_baseline.json`](data/exp09_v140_baseline.json): the v1.4.0 baseline.

Figure: [`figures/fig8_exp09.png`](figures/fig8_exp09.png).

### Pre-registered run (render 11)

| Check | Result |
|---|---|
| H0 render verification | **pass**: 7212 frames, h264 1920×1080 30/1 + aac, 240.405 s for a 240.41 s song ([exp04](exp04_render_verification.md)) |
| H1 dwell | **pass**: every panel ≥ 3 s, except the one cut-limited panel (rome, 2.76 s ≥ 2.5); median 5.8 s |
| H2 concurrency | **pass**: at most 2 panels at once |
| H3 no cover | **pass**: no panel slot overlaps a protected region or a band |
| H4 the 0:14 gap | **fail**: median log₂(v1.5.0 / v1.3.0) = −0.58 at 13–18 s (all six frames −0.55 to −0.59) |
| H5 detail vs v1.4.0 (before the outro) | **pass**: median +0.027, section-bootstrap CI [−0.049, +0.088]; frame bootstrap [−0.000, +0.057]; 63/107 frames larger |

**Why H4 failed, and what changed.**
- Against v1.4.0, the frames at 15 and 17 s gained detail: +0.37 and +0.29 log₂. The tokens card now stays full-size until the cut instead of shrinking to a corner.
- They stayed about 0.56 log₂ below v1.3.0, whose giant glowing title filled that window.
- The approved plan included a match cut in which the tokens stream into verse 1's tunnel. Render 11 had only the scrolling embedding column.
- **Post-hoc fix:** verse 1's layer grids now fly out of the vanishing point behind the card, and the column returns to full brightness. The video was re-rendered (render 12), and H4 and H5 were measured again.
- These are post-hoc numbers, so they are reported separately. **The pre-registered H4 result is a failure.**

### Post-hoc run (render 12, the released video)

| Check | Result |
|---|---|
| H0 | **pass**: 7212 frames, 240.405 s |
| H1–H3 | unchanged: the timeline and layout did not change |
| H4 (post hoc) | **still below the criterion**: median −0.093 (frames −0.156 to −0.061). Against v1.4.0 the same window gained +0.26, +0.83 and +0.80 log₂ at 13, 15 and 17 s |
| H5 | **pass**: median +0.033, section-bootstrap CI [−0.047, +0.102]; 65/107 frames larger |

**Reading.** The intro window is now within about 6 % of v1.3.0's PNG detail, and far fuller than v1.4.0. It still does not meet the pre-registered "≥ 0", so H4 is reported as **not met**. The threshold was not tuned after the fact.


**H5 per section** (render 11, median log₂ v1.5.0 / v1.4.0):
- intro +0.005;
- verse 1 +0.209, pre-chorus 1 +0.104, chorus 1 −0.008;
- verse 2 +0.088, pre-chorus 2 +0.088, chorus 2 +0.044;
- verse 3 −0.076, bridge −0.219, final chorus +0.097.

Verse 1 regained what exp08 had found lost (−0.19 against v1.3.0). The bridge lost detail: its 21 formula cards became star labels that grow two at a time, and the sphere shrank.

**Descriptive: how long figures are shown, and what they cover.**

| | v1.4.0 (hero model) | v1.5.0 |
|---|---|---|
| Figures | 86 | 82 (50 panels, 32 drawn by their scenes) |
| Median seconds a figure is the hero (v1.4.0) / on screen (v1.5.0) | 2.22 s | 6.0 s |
| Figures shown under 2 s | 41 of 86 | 1 of 82 (the closing "Intentional design" banner, 0.94 s) |
| Share of the time a figure covered a protected scene object | 100 % (every hero second) | 0 % (no slot overlaps a protected region) |

The v1.4.0 numbers are its *hero* seconds, the time a figure was the main, readable centre of the frame. v1.4.0 cards stayed longer as small receded thumbnails. The v1.5.0 numbers are the seconds on screen at full panel size. The "covered" share uses v1.5.0's protected regions for both versions, and v1.4.0's nominal 600 × 350 hero box at its hero scale.

## What this does and does not show

- **It shows that the layout constraints hold by construction:**
  - figures stay on screen long enough to read;
  - at most two compete in a scene;
  - none covers the ladder, the SGD swarm, the closing statement or the lyrics.
- **Overall detail is not lower** than v1.4.0 before the outro.
- **The 0:14 window is fuller than v1.4.0**, but the pre-registered comparison with v1.3.0 failed on render 11.
- **It does not show that viewers find the video more unified or easier to follow.** No viewer study was run. "Two overlapped videos" is a perceptual judgement, and the metrics here only check the layout properties meant to address it.
- **Limitations:**
  - The protected regions are static rectangles, so moving 3D objects (orbiting landscape points, rotating atlas stars) can still pass under a panel.
  - PNG size measures detail, not quality.
  - The rewind replaces the outro's content entirely, so the outro is outside the density test.

## Learnings

- **A layout contract beats a camera trick.** v1.4.0 made a figure the centre of attention by dimming and pushing the scene. That is exactly what made the two layers read as separate videos. Reserving slots in each scene's own composition, and testing them against the scene's key objects, fixed the cover problem by construction.
- **Let the scene draw what it can.** Where a scene already showed an idea (the antonym stream, the bit rain, an atlas star's formula), drawing the figure in place removed a duplicate panel and a short-lived card at the same time.
- **Pre-registered checks catch what the eye forgives.** The intro looked filled in stills, but against the v1.3.0 baseline it was still sparse. The failure pointed at a planned element that had been skipped.
