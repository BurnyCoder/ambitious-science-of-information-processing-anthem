# Scene guide

Each song section is mapped to a scene id in `content/scenes.toml`, and each id to a component in `video/src/scenes/index.ts`.

**What all scenes have in common:**
- Every scene is a pure function of the frame number.
- Keyword-triggered reveals use `wordTime(tl, section, /regex/)`, the moment the word is sung according to the aligned timings. If the word is missing, they fall back to evenly spaced times.
- Every scene sits on the shared layers: starfield, spectrum ring, beat/cut flashes and HUD. Karaoke appears everywhere except the `bigLyrics` scenes.

| Section | Scene id | What is shown | Triggered by | Grounding / sources |
|---|---|---|---|---|
| Intro | `intro` | One token unfolds into a 16-cell embedding vector, then the title card types out letter by letter, followed by the credits. | Scene-local time; beat pulse | — |
| Verse 1 | `layers` | Fly-through of 16 layers of 12×7 neurons with sparse weight lines. A ReLU-gated activation wave moves forward. Panel: hₗ₊₁ = σ(Wₗhₗ+bₗ), a ReLU plot, a parameter counter running 10³ → 10¹². | Song time; energy; beats | Standard MLP layer equation |
| Pre-chorus 1 | `landscape` | Toy non-convex loss surface (wide flat basin, sharp narrow basin, saddle tilt, ripples) as a height-colored point lattice. 28 noisy gradient-descent particles (η = 0.5, step clipped to 0.6, annealed noise) leave trails. | Section progress | Flat minima ↔ generalization: Hochreiter & Schmidhuber 1997 (*Neural Computation*); Keskar et al. 2017 ([arXiv:1609.04836](https://arxiv.org/abs/1609.04836)). The surface is illustrative only. |
| Chorus ×2 | `chorus` | A layered graph in which a new seeded "circuit" (one node per layer) lights up on every downbeat. The sung word slams in at giant size. The second chorus swaps the palette. | Downbeats; word onsets | Circuits as the unit of mechanistic explanation |
| Verse 2 | `ladder` | Seven rungs light up bottom to top as each is sung (neurons & heads → activation manifolds → parameter components → algorithms → decisions → behaviors → drives). A climber rides to the latest rung. The "Encyclopedia of explanations" panel opens on "encyclopedia". | `/neuron/`, `/manifold/`, `/parameter/`, `/algorithm/`, `/decision/`, `/behavior/`, `/drive/`, `/encyclopedia/`, `/recalls/`, `/reasoning/` | Goodfire, ["We can and must solve alignment"](https://www.goodfire.com/blog/we-can-and-must-solve-alignment) (ladder of abstraction, encyclopedia) |
| Pre-chorus 2 | `manifolds` | Three point-cloud manifolds: a 12-cluster ring, a helix and a sphere. They start blurred and sharpen over the section ("bigger → crisper"). A "function vector" arrow appears when that phrase is sung. | `/function/`; section progress | Circular day/month features: Engels et al. 2024 ([arXiv:2405.14860](https://arxiv.org/abs/2405.14860)). Space/time representations more accurate with scale: Gurnee & Tegmark 2023, §3.1 ([arXiv:2310.02207](https://arxiv.org/abs/2310.02207)). Function vectors: Todd et al. 2023 ([arXiv:2310.15213](https://arxiv.org/abs/2310.15213)). |
| Verse 3 | `theory` | Five pillars, one per research direction, rise when sung. A log-log scaling-law plot L(N) = L∞ + A·N^(−α) draws itself through synthetic points. A "FALSIFIABLE · QUANTITATIVE" stamp appears, and a predicted point is circled. | `/solve/`, `/limits\|infinity/`, `/laws\|scaling/`, `/hyperparameter/`, `/universal/`, `/falsifiable/`, `/predict/` | Simon, Kunin et al. 2026, *There Will Be a Scientific Theory of Deep Learning* ([arXiv:2604.21691](https://arxiv.org/abs/2604.21691)). The plot data are synthetic. |
| Bridge | `atlas` | 30 fields as stars on a rotating Fibonacci sphere, linked as a 3-nearest-neighbour graph. Stars ignite when their field is sung; the rest ignite at "every level". Closes on "ONE SCIENCE OF INFORMATION". | Field keywords; `/level/`, `/atlas/`, `/science/` | The list of lenses in the project brief |
| Final chorus | `finale` | Gold key-change palette. Left: a causal DAG where `do(circuit := c′)` cuts the incoming edges and the downstream behavior changes. Right: a 280-bit periodic string collapses into K(x) = min{\|p\| : U(p) = x}. Center: giant sung words. | `/counterfactual/`, `/shortest/` | Pearl, *Causality* (2009); Kolmogorov (1965) |
| Outro | `outro` | A particle ring contracts back into the single token. "THE GOAL IS TO UNDERSTAND." appears after the last sung word, then the credits, then a fade to black. | Last line's end time | — |

## Adding or changing a scene

1. Create `video/src/scenes/MyScene.tsx`. It exports a `React.FC<SceneProps>` and uses `useSceneClock(section)` for timing.
2. Register it in `video/src/scenes/index.ts` with a HUD caption. Set `bigLyrics: true` if the scene draws its own lyrics.
3. Map a section to it in `content/scenes.toml`, then re-run `uv run anthem --stage timeline`.
4. Check it with `cd video && node scripts/stills.mjs <frame>`, or interactively with `npm run studio`.
