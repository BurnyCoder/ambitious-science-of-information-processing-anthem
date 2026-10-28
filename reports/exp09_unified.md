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

**Result.** 86 → 82 cards: 49 panels and 33 drawn by their scenes. Line coverage stays 1.0.

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

*(filled in after the render)*
