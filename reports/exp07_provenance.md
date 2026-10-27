# Experiment 07: figure cards grounded in released data (provenance, consistency, coverage, density)

**Question.** Release v1.3.0 adds 86 figure cards ([catalog](../docs/vignettes.md)), so that every sung line gets a concrete, cited illustration. Three things need to hold:
- Every card labelled "released data" must be traceable to a pinned file published by the original authors or a well-known third party, without re-running their experiment.
- The derived numbers must agree with what the papers report.
- The new video must cover every sung line and carry measurably more visual detail than v1.2.0.

**Rules set by the user for this experiment:**
1. Reuse released models, results and data; never re-run an experiment whose outputs exist. Retrain only if nothing usable exists.
2. Look first at the original authors, papers and well-known third parties (ARENA, Neuronpedia, Epoch AI).
3. Use the user's own Hugging Face account only as a last resort. In the end it was not needed: Goodfire's own repository supplied the block-sparse-featurizer figure.

**Nothing was trained or re-run.** The only candidate for retraining was the toy-superposition pentagon. It turned out to exist as a figure saved in the outputs of Anthropic's own notebook.

## Pre-specified checks

The checks were fixed in the approved plan before the data phase ran:
1. The five largest Fourier frequencies of the released epoch-40k embedding of Nanda et al.'s mainline grokking run equal the paper's key frequencies {14, 35, 41, 42, 52}.
2. ARENA's five highest per-head induction scores for GPT-2 small include the IOI paper's induction heads 5.5 and 6.9.
3. Every number shown on screen matches its source file or paper table (fact-check table below).
4. Card coverage: 100 % of sung, non-backing lyric lines have a card triggered by one of their words.
5. Visual density: the median paired log₂(PNG bytes v1.3.0 / v1.2.0) over frames sampled every 2 s is > 0, with a section-bootstrap 95 % CI that excludes 0.

## Method

- [`scripts/vignette_data.py`](../scripts/vignette_data.py) downloads 31 pinned files (523.8 MB) once into `data/external/` (gitignored).
  - For each file it records URL, revision (commit or HF revision, or "accessed copy" with the access date for files that change over time), licence, size and sha256 in [`data/exp07_sources.json`](data/exp07_sources.json).
  - It writes compact card data to `video/public/vignettes/`.
- **Untrusted downloads:**
  - `.pth` files are loaded with `torch.load(weights_only=True)`.
  - The double-descent pickle is loaded through a numpy-only unpickler that refuses every other global. This is tested with a malicious pickle in `tests/test_external.py`.
  - HTML and notebooks are parsed as text and never executed.
  - From the refusal-direction run, only the summary keys of the evaluation files are read; the model completions are never displayed.
- **Derivations, all pure functions** in [`scripts/analysis/external.py`](../scripts/analysis/external.py), unit-tested on synthetic inputs:
  - log-spaced downsampling of loss curves;
  - Fourier norms of a ℤ₁₁₃ embedding along cos/sin of each frequency (the basis used in Nanda et al.'s code);
  - the heatmap grid inside a plotly HTML export;
  - attribution graphs collapsed to the authors' curated supernodes, with member link weights summed.
- **Live math** in the video (`video/src/lib/mathviz.ts`) is checked by 7 known-answer tests:
  - ReLU linear regions;
  - random-vector cosines, whose variance must be ≈ 1/d;
  - the Marchenko–Pastur density, which must integrate to 1;
  - the Chinchilla form;
  - deep-linear mode dynamics, which must go from u₀ to s;
  - random wide nets, whose output variance must be ½.

## Sources used

| Card(s) | Source | Licence | Revision |
|---|---|---|---|
| grokking curves, Fourier clock | HF [`callummcdougall/grokking_full_run_data`](https://huggingface.co/callummcdougall/grokking_full_run_data) `full_run_data.pth` (Nanda et al. 2023 mainline run, 456 MB) | none stated | `80e5dbb` |
| weight decay 1.0 vs 0.1 | [`progress-measures-paper`](https://github.com/mechanistic-interpretability-grokking/progress-measures-paper) `saved_runs/wd_10-1_mod_addition_loss_curve.pth` | none stated | `23d2c64` |
| induction heads | [ARENA](https://info-arena.github.io/ARENA_img/misc/media-12/1206-A.html) 12×12 score grid | none stated | `7eb0b60` |
| Dallas / rabbit / 36+59 graphs, chorus circuits | [transformer-circuits.pub graph JSON](https://transformer-circuits.pub/2025/attribution-graphs/biology.html) (Lindsey et al. 2025) | none stated | accessed copy |
| Gemma outputs | [Neuronpedia graph `gemma-fact-dallas-austin`](https://www.neuronpedia.org/gemma-2-2b/graph) (circuit-tracer) | none stated (Gemma Scope weights CC-BY-4.0) | accessed copy |
| "Friday" latent, weekday chords | [Neuronpedia API](https://www.neuronpedia.org/gpt2-small/7-res-jb/4733), 9 day latents listed by Engels et al. | none stated (SAE weights MIT) | accessed copy |
| scale bars | [Epoch AI Notable AI Models](https://epoch.ai/data/ai-models) | CC BY 4.0 | accessed copy |
| Chinchilla plot | [`epoch-research/analyzing-chinchilla`](https://github.com/epoch-research/analyzing-chinchilla) `svg_extracted_data.csv` | none stated | `9225883` |
| double descent | [`gs://hml-public/dd/cifar10-resnet18k-p15-adam-reps`](https://gitlab.com/harvard-machine-learning/double-descent) (Nakkiran et al. Fig. 1 runs) | none stated | accessed copy |
| world map, globe | [`wesg52/world-models`](https://github.com/wesg52/world-models) `world_place.csv` | MIT | `a572f16` |
| function vectors | [`ericwtodd/function_vectors`](https://github.com/ericwtodd/function_vectors) `antonym.json` | MIT | `fb9eac7` |
| refusal | [`andyrdt/refusal_direction`](https://github.com/andyrdt/refusal_direction) Llama-3-8B-Instruct run | Apache-2.0 | `9d852fa` |
| random matrices | [`CalculatedContent/ww-trends-2020`](https://github.com/CalculatedContent/ww-trends-2020) `gpt2 small.csv` | none stated | `efe4723` |
| superposition | [`anthropics/toy-models-of-superposition`](https://github.com/anthropics/toy-models-of-superposition) notebook's saved intro figure | MIT | `562710e` |
| concepts as regions | [`goodfire-ai/block-sparse-featurizer`](https://github.com/goodfire-ai/block-sparse-featurizer) `assets/figure_1.png` | MIT | `219f121` |
| tokens | HF [`openai-community/gpt2`](https://huggingface.co/openai-community/gpt2) `tokenizer.json` | MIT | `607a30d` |

**Use of sources without a stated licence:**
- Where no licence is stated, only small derived numbers are committed (`video/public/vignettes/*.json`), with attribution on screen and in the ticker. The source files themselves are not redistributed.
- Some data was deliberately not used:
  - Papyan et al.'s neural-collapse deposit (CC BY-NC-ND);
  - Geometry of Truth's repository (no licence);
  - Anthropic's other attribution graphs (only the three prompts named in the lyrics' context are used).

## Results

| # | Check | Result |
|---|---|---|
| 1 | Top-5 Fourier frequencies of the released epoch-40k W_E | **pass**: {14, 35, 41, 42, 52}. The 6th largest is 31, matching the six non-negligible frequencies ARENA names. |
| 2 | ARENA top-5 induction heads include 5.5 and 6.9 | **pass**: 5.5 = 0.909, 6.9 = 0.898, 5.1 = 0.897, 7.10 = 0.891, 7.2 = 0.825 |
| 3 | On-screen numbers match their sources | **pass after corrections** (table below) |
| 4 | Card coverage of sung non-backing lines | **pass**: 56 / 56 lines (86 cards; the shortest is on screen 2.0 s) |
| 5 | Visual density v1.3.0 vs v1.2.0 | **pass**: median log₂ ratio +0.262, section-bootstrap 95 % CI [+0.183, +0.424] ([details](#visual-density)) |

**Descriptive numbers from the released data** (not pre-registered; one run each, so no error bars):
- **Weight decay.** Test loss first drops below 1 at epoch 9,890 with weight decay 1.0, and at epoch 90,890 with 0.1.
  - The two runs also differ in seed (0 vs 1). The stored `config` dict of the 0.1 run says `weight_decay: 1`, but its optimizer state records 0.1.
- **Double descent** (5 trials, test error on clean labels as stored).
  - Test error is lowest at width 4 (0.219), peaks at width 10 (0.303) where train error approaches 0, and falls to 0.163 at width 64.
- **Refusal** (JailbreakBench, Llama-3-8B-Instruct): the share of harmful requests answered without a refusal phrase is 5 % at baseline and 100 % with the direction ablated. The LlamaGuard-2 judge gives 3 % and 82 %.
- **Gemma-2-2B** on the Dallas prompt: "Austin" 0.450, "not" 0.073, "the" 0.055, "Texas" 0.040.

### Fact-check of on-screen numbers and claims

| Claim on screen | Source | Status |
|---|---|---|
| AlexNet 60M, GPT-2 1.5B, GPT-3 175B, PaLM 540B, Switch-C 1.57T parameters | Epoch CSV: 6.0e7, 1.5e9, 1.746e11, 5.4035e11, 1.571e12 | ok; the plan's "1.6T" for Switch was corrected to 1.571T |
| Chinchilla fits E, A, B, α, β | Hoffmann et al. (TeX values 1.6934, 406.4, 410.7, 0.3392, 0.2849); Besiroglu et al. 2024 Table 1 (1.8172, 482.01, 2085.43, 0.3478, 0.3658) | ok |
| Kaplan exponents 0.076 / 0.095 / 0.050 | Kaplan et al. 2020, Eqs. 1.1–1.3 | ok |
| Gurnee & Tegmark world R² .881 / .896 / .911 | Table 2 (linear probe) | ok |
| Othello probe accuracy 90.9 … 99.6 % by layer | Nanda, Lee & Wattenberg 2023, Table 1 | ok |
| Golden Gate feature 34M/31164353 | Templeton et al. 2024 | ok. The quote "I am the Golden Gate Bridge…" and a "×10" clamp could not be verified against the paper or Anthropic's page, so both were **removed**. |
| ActAdd "Love" − "Hate", "I hate you because…" and both completions | Turner et al. 2023, Table 1 | ok. The plan's "layer 6, ×5" is not stated for Table 1, so it was **removed**. |
| Polysemantic neuron: citations, English dialogue, HTTP requests, Korean text | Anthropic 2023, "Decomposing Language Models Into Understandable Components" | ok |
| Probes catch sleeper agents (linear probe on the residual stream) | MacDiarmid et al. 2024 (AUROC > 99 %) | ok |
| WeightWatcher "α per layer: < 2 over-trained, > 8 random-like" | WeightWatcher README | **corrected**: the plan's "2–6 = well trained" band is not in the README |
| IOI head classes and indices | Wang et al. 2022, Fig. 2 | ok |
| Towards Monosemanticity feature ids A/1/3450, 2937, 2357, 416 | Bricken et al. 2023 | ok |
| Landauer kT ln 2 ≈ 2.87 × 10⁻²¹ J at 300 K | 1.380649 × 10⁻²³ × 300 × ln 2 | ok |
| Lloyd ≤ 5.4 × 10⁵⁰ ops/s per kg | Lloyd 2000 (arXiv v3: 5.4258 × 10⁵⁰) | ok |
| Gardner α_c = 2 | Gardner 1988 | ok |
| 86 billion neurons; 80 billion transistors (H100) | Azevedo et al. 2009; NVIDIA H100 whitepaper | ok |
| hydrogen line 1420.405 MHz, λ ≈ 21 cm, t ≈ 0.7 ns | c / f = 21.1 cm; 1 / f = 0.704 ns | ok |
| GPT-2 ids We 1135, " will" 481, " know" 760 | GPT-2 `tokenizer.json` | ok (computed) |
| "280 bits → a 40-character program" | computed from the drawn program | ok |

## Visual density

[`scripts/validate_density.py`](../scripts/validate_density.py) decoded one frame every 2 s (120 timestamps) from the released v1.2.0 MP4 and the v1.3.0 render, PNG-encoded each frame, and compared sizes in pairs. Lossless-compression size is a standard proxy for visual complexity: Machado et al. 2015 found compression-based measures among the best predictors of human complexity ratings.

| Measure | Value |
|---|---|
| median PNG size per frame | 812 kB (v1.2.0) → 1,052 kB (v1.3.0) |
| median log₂(v1.3.0 / v1.2.0) | **+0.262** (≈ 1.20×) |
| 95 % CI, sections resampled (primary; frames within a section are autocorrelated) | [+0.183, +0.424] |
| 95 % CI, frames resampled (secondary) | [+0.212, +0.351] |
| frames where v1.3.0 is larger | 115 / 120 |
| pre-specified check | **pass** |

Per section (median log₂ ratio):
- **Largest gains:** bridge +0.634, verse 2 (ladder) +0.577, final chorus +0.515.
- **Middle:** outro +0.393, verse 3 +0.377, pre-chorus 2 +0.329, intro +0.211, the two choruses +0.184 and +0.215, pre-chorus 1 +0.139.
- **Verse 1 (layers) is unchanged at +0.008.** Its 3D fly-through already filled the frame; the cards replaced the scene's own panels rather than adding to empty space.

**Limitations.** Compressed size measures detail, not quality, legibility or musical fit. It is also inflated by anything that adds texture, including the faint equation dust. No viewer study was run.

## Learnings

- **Search for the artifact before planning a run.** The first plan proposed training a toy model, a grokking run and GPT-2 inference.
  - Three targeted searches found released files for almost everything: the mainline grokking run, the attribution-graph JSON behind the Biology paper, ARENA's score grid, Neuronpedia's feature API, Epoch's datasets, Nakkiran et al.'s raw runs and Arditi et al.'s refusal scores.
  - Reusing them is faster, and it shows the authors' own numbers rather than a reproduction that might differ by seed.
- **Saved notebook outputs count as released results.** The superposition pentagon is not available as weights, but the authors' notebook stores the rendered figure of their trained W at 10 sparsity levels, so no retraining was needed.
- **Stored configs can be stale.** `wd_10-1_mod_addition_loss_curve.pth` says `weight_decay: 1` in its `config`, but its optimizer state says 0.1, which matches the file name. The optimizer state was used, and the discrepancy is reported.
- **Some released files are not what they seem.** `mod_addition_no_wd.pth` generalizes within 5,000 epochs without weight decay. Its training fraction is not recorded, so the run was left out rather than shown as "no weight decay never groks".
- **Fact-checking the screen text found three overclaims**, all of them in our own plan rather than in the sources: a quote, a hyperparameter and a "well trained" band. Each was removed or corrected, as listed in the table above.
- **Check against the source you cite, not against memory.** The WeightWatcher "2–6" band circulates in third-party write-ups, but the README the card cites says something different.
- **Visual review of every card still found layout bugs** that typecheck and tests cannot catch:
  - attribution-graph labels overlapping in short cards;
  - a schematic curve leaving its axis;
  - a truncated bar axis (Othello) that would have exaggerated differences, which was fixed to 0–100 %;
  - duplicated captions.
