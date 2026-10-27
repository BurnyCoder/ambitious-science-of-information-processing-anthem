# Scene guide

Each song section is mapped to a scene id in `content/scenes.toml`, and each id to a component in `video/src/scenes/index.ts`.

On top of the scenes runs the **illustration track**: 86 figure cards, one or more per sung line, each timed to the word it illustrates and carrying a provenance badge and a citation. The cards, their times and sources are listed in [vignettes.md](vignettes.md) (generated); how they are placed and drawn is in [architecture.md](architecture.md).

**What all scenes have in common:**
- Every scene is a pure function of the frame number.
- Keyword-triggered reveals use `wordTime(tl, section, /regex/)`, the moment the word is sung according to the aligned timings. If the word is missing, they fall back to evenly spaced times.
- Every scene sits on the shared layers: starfield, drifting equation dust (the section's card titles), spectrum ring, figure cards, beat/cut flashes, HUD and a citation ticker. The scene layer punch-zooms on downbeats and RGB-splits for 0.25 s after each cut. Karaoke appears everywhere except the `bigLyrics` scenes.

| Section | Scene id | What is shown | Triggered by | Grounding / sources |
|---|---|---|---|---|
| Intro | `intro` | The GPT-2 token " know" (id 760) unfolds into 16 of its 768 embedding cells (illustrative values), then the title card types out letter by letter, followed by the credits. | Scene-local time; beat pulse | — |
| Verse 1 | `layers` | Fly-through of 16 layers of 12×7 neurons with sparse weight lines. A ReLU-gated activation wave moves forward. The layer equation, the bend and the parameter scale are cards around it. | Song time; energy; beats | Standard MLP layer equation |
| Pre-chorus 1 | `landscape` | Toy non-convex loss surface (wide flat basin, sharp narrow basin, saddle tilt, ripples) as a height-colored point lattice. 28 noisy gradient-descent particles (η = 0.5, step clipped to 0.6, annealed noise) leave trails. | Section progress | Flat minima ↔ generalization: Hochreiter & Schmidhuber 1997 (*Neural Computation*); Keskar et al. 2017 ([arXiv:1609.04836](https://arxiv.org/abs/1609.04836)). The surface is illustrative only. |
| Chorus ×2 | `chorus` | A layered graph in which a real circuit lights up on every downbeat: the strongest path (greedy heaviest edges to the output) of an attribution graph released with Lindsey et al. 2025, labelled with the authors' supernode names. Chorus 1: Dallas → Austin; chorus 2: 36+59 and the rabbit couplet. The sung word slams in at giant size; the second chorus swaps the palette. | Downbeats; word onsets | [Lindsey et al. 2025](https://transformer-circuits.pub/2025/attribution-graphs/biology.html) graph JSON |
| Verse 2 | `ladder` | Seven rungs light up bottom to top as each is sung (neurons & heads → activation manifolds → parameter components → algorithms → decisions → behaviors → drives). A climber rides to the latest rung. Concrete examples per rung, and the encyclopedia, are cards. | `/neuron/`, `/manifold/`, `/parameter/`, `/algorithm/`, `/decision/`, `/behavior/`, `/drive/` | Goodfire, ["We can and must solve alignment"](https://www.goodfire.com/blog/we-can-and-must-solve-alignment) (ladder of abstraction, encyclopedia) |
| Pre-chorus 2 | `manifolds` | Three point clouds: a 12-cluster ring, a helix and a globe of 900 real places (Gurnee & Tegmark's dataset). They start blurred and sharpen over the section ("bigger → crisper"). A "function vector" arrow appears when that phrase is sung. | `/function/`; section progress | Circular day/month features: Engels et al. 2024 ([arXiv:2405.14860](https://arxiv.org/abs/2405.14860)). Space/time representations more accurate with scale: Gurnee & Tegmark 2023, §3.1 ([arXiv:2310.02207](https://arxiv.org/abs/2310.02207)). Function vectors: Todd et al. 2023 ([arXiv:2310.15213](https://arxiv.org/abs/2310.15213)). |
| Verse 3 | `theory` | Five pillar cards, one per research direction, appear when sung. A real scaling plot: Epoch AI's 245 points extracted from Hoffmann et al. 2022 Fig. 4, with the iso-FLOP curves of two published fits (Hoffmann; Epoch's re-fit) and their compute-optimal minima; the 10²¹-FLOP optimum is circled as "predicted before training". A "FALSIFIABLE · QUANTITATIVE" stamp appears. | `/falsifiable/`, `/predict/` (pillars: their card triggers) | Simon, Kunin et al. 2026 ([arXiv:2604.21691](https://arxiv.org/abs/2604.21691)); Hoffmann et al. 2022; Besiroglu et al. 2024 ([arXiv:2404.10102](https://arxiv.org/abs/2404.10102)) |
| Bridge | `atlas` | 30 fields as stars on a rotating Fibonacci sphere, linked as a 3-nearest-neighbour graph, each with a formula chip. Stars ignite when their field is sung; the rest ignite at "every level". Closes on "ONE SCIENCE OF INFORMATION". | Field keywords; `/level/`, `/atlas/`, `/science/` | The list of lenses in the project brief |
| Final chorus | `finale` | Gold key-change palette: gold rays pulse on the bar behind the giant sung words. The do()-intervention graph, the shortest program, AIXI, ActAdd and an ARC-style puzzle are cards above and below the words. | Word onsets | Pearl, *Causality* (2009); Kolmogorov (1965) |
| Outro | `outro` | A particle ring contracts back into the single token. "THE GOAL IS TO UNDERSTAND." appears after the last sung word, then the credits, then a fade to black. | Last line's end time | — |

## Adding or changing a scene

1. Create `video/src/scenes/MyScene.tsx`. It exports a `React.FC<SceneProps>` and uses `useSceneClock(section)` for timing.
2. Register it in `video/src/scenes/index.ts` with a HUD caption. Set `bigLyrics: true` if the scene draws its own lyrics.
3. Map a section to it in `content/scenes.toml`, then re-run `uv run anthem --stage timeline`.
4. Check it with `cd video && node scripts/stills.mjs <frame>`, or interactively with `npm run studio`.
