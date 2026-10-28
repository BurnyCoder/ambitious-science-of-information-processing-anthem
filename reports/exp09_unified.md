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

*(filled in as the cards are changed; each entry gives the card, the change, and why)*

## Results

*(filled in after the render)*
