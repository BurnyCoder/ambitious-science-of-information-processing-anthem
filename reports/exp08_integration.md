# Experiment 08: figure cards integrated into the scenes (dive-in hero shots)

**Question.** In v1.3.0 the 86 figure cards sat in corner boxes beside the main animation. Release v1.4.0 turns them into *hero shots*:
- each card dives out of the scene object its lyric names (a ladder rung, a theory pillar, an atlas star, a chorus circuit node, a manifold);
- it takes centre stage without a frame for at most 3.2 s while the camera pushes gently toward that object;
- it then recedes into depth, and at its end flies back and docks into the object.

The scenes themselves also gained concrete layers inside their general pictures. Examples:
- the loss surface's own saddle with its Hessian eigenvalues;
- the released grokking and double-descent curves;
- the real prompt tokens under the chorus circuits;
- GPT-2 token ids of the sung line in the layer tunnel;
- the 280-bit string collapsing into its program.

Three things need to hold:
1. The render still passes the automated verification.
2. The video keeps its visual detail. Moving content into the scenes must not make frames emptier.
3. The general scenes keep part of the frame, and the hero shots obey the balance rule set in the plan. A hero covers at most about 60 % of the frame, stays hero for at most 3.2 s, and at most 4 cards are active at once.

## Pre-specified checks

These were fixed in the approved plan and in this file **before** the v1.4.0 render and the comparison were run. The margin and the decision rule are committed with the scripts in [`scripts/validate_density.py`](../scripts/validate_density.py) and [`scripts/analysis/stats.py`](../scripts/analysis/stats.py) (`density_decision`).

1. **Render verification.** `out/anthem_verify.json` reports `ok: true`, using the unchanged criteria of [experiment 04](exp04_render_verification.md).
2. **Detail non-inferiority vs v1.3.0** (primary).
   - Frames are sampled every 2 s at the same timestamps in both videos, and each is PNG-encoded.
   - The statistic is the median paired log₂(bytes v1.4.0 / bytes v1.3.0).
   - Its 95 % CI comes from a bootstrap that resamples whole song sections.
   - **The test passes if the CI's lower bound is above −0.10.**
   - A margin of 0.10 log₂ units means at most about 7 % fewer PNG bytes per frame. This is the non-inferiority form recommended by CONSORT: the CI bound is compared with a margin fixed in advance ([Piaggio et al. 2012](https://doi.org/10.1001/jama.2012.87802)).
   - The baseline is the released v1.3.0 MP4. Its sha256 `3ecb6371…4c60` equals the digest GitHub lists for the [v1.3.0 asset](https://github.com/BurnyCoder/ambitious-science-of-information-processing-anthem/releases/tag/v1.3.0).
3. **Integration measures** (descriptive, computed from `timeline.json` with a Python mirror of the shot lifecycle).
   - **Definitions:**
     - a card "is the hero" while its heroness is ≥ 0.5;
     - heroness = emerge × (1 − min(1, rank)) × (1 − dock), as in [`video/src/stage/shots.ts`](../video/src/stage/shots.ts).
   - **Measures:**
     - share of sung time with a hero;
     - share of the whole song in which the general scene has the frame alone;
     - mean nominal frame coverage of the hero during sung time;
     - longest hero time of any card;
     - most cards active at once;
     - cards docked per section.
   - **Design checks** (pass/fail):
     - hero area ≤ 0.6 of the frame;
     - hero time ≤ 3.2 s plus half an ease (0.2 s) plus one frame;
     - ≤ 4 cards active at once.

**What would count against the change:**
- a failed render verification;
- a density CI lower bound ≤ −0.10, meaning frames became measurably emptier;
- a design check failing.

## Method

- **Shot lifecycle.** [`video/src/stage/shots.ts`](../video/src/stage/shots.ts) is a pure function of time with three node tests ([`video/tests/shots.test.ts`](../video/tests/shots.test.ts)).
  - [`scripts/analysis/shots.py`](../scripts/analysis/shots.py) mirrors it line for line.
  - The Python mirror reads the timing constants, hero scales, fly-through scenes and giant-lyric scenes from the TypeScript sources, so the two cannot drift apart silently.
  - [`tests/test_integration.py`](../tests/test_integration.py) repeats the TS test cases.
- **Anchors.** Each scene exports the geometry it draws, and [`video/src/stage/anchors.ts`](../video/src/stage/anchors.ts) reads it, so docks follow the drawn objects: the rotating atlas stars, the pillar boxes, the ladder rungs.
- **Nominal hero area.** The card box is 600 × 350 px (body 250 px + title, caption and lower third), scaled by the hero scale:
  - 1.8 in most scenes, giving 32.8 % of a 1920 × 1080 frame;
  - 1.38 in the chorus-type scenes, where giant words take the lower third, giving 19.3 %.
- **Density.** The method is unchanged from experiment 07 (PNG bytes as a complexity proxy, [Machado et al. 2015](https://doi.org/10.1016/j.actpsy.2015.06.005)). Only the decision rule changes, from superiority to non-inferiority.

## Results

*(filled in after the render; see below)*
