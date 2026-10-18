# Experiments: summary

The project is a generative-art pipeline, not a model-training project. Its "experiments" are measurements of the components that decide **when** things happen in the video: which take is used, when each word lights up, and where the beats are. Each one has a question, a criterion fixed before the run, raw data in [`data/`](data), and a dedicated report.

| # | Experiment | Pre-specified criterion | Result | Report |
|---|---|---|---|---|
| 01 | One Suno V6 generation; take selection | Structure as requested; select by coverage, then hootCer | 2 takes of 240.40 s and 239.92 s; coverage 1.0/1.0; take 1 chosen by hootCer 0.155 < 0.165 | [exp01](exp01_song_generation.md) |
| 02 | Beat tracker vs ground-truth click tracks (12 tempos × 2 noise levels × 2 hops × 5 seeds) | Hop 256, clean: every run \|tempo err\| ≤ 2 BPM and F(±70 ms) ≥ 0.95 | **FAIL** (11/12 tempos pass; half-tempo lock at 170 BPM). Beats within 15–19 ms; hop 512 quantizes tempo by up to ±3.55 BPM; song at 129 BPM is in the passing range | [exp02](exp02_beat_tracking.md) |
| 03 | Suno word timings (raw vs repaired) vs an independent Whisper reference | H1: median \|Δonset\| ≤ 0.25 s; H2: repair reduces error on the repaired words (Wilcoxon, α = 0.05); random-shift control | H1 **pass** (0.235 s / 0.172 s vs control 0.59 / 0.50 s); H2 **falsified** for repair v1 (−1.14 s, p ≈ 1), so it was replaced by minimal post-hoc v2 (2 words, descriptive only) | [exp03](exp03_alignment_repair.md) |
| 04 | Full render and automated verification | 1920×1080, 30 fps, h264+aac, \|duration − song\| ≤ 0.5 s; visual inspection of every scene | **pass**: 7213 frames, 240.45 s vs 240.42 s; 6 layout defects found in stills and fixed before the full render | [exp04](exp04_render_verification.md) |

## Models and tools in the pipeline (for a lay reader)

| Component | What it is | Architecture / algorithm | Objective / training | Data | Used for here | Measured quality here |
|---|---|---|---|---|---|---|
| Suno V6 (via sunoapi.org) | Commercial text-to-music model | Not public | Not public | Not public | Generating the sung song from our lyrics and style text | Structure as requested ([exp01](exp01_song_generation.md)); musical quality not measured |
| Suno timestamped lyrics | The provider's lyric-to-audio aligner | Not public (returns per-word start/end, `success`, `hootCer`) | Not public | — | Word timings for the karaoke | All words aligned; artifacts found and repaired ([exp03](exp03_alignment_repair.md)) |
| librosa `beat_track` | Classical, non-learned beat tracker | Onset-strength envelope, then tempo estimate, then dynamic programming (Ellis 2007) | None (hand-designed objective: beats on strong onsets at a steady period) | — | Beat and downbeat times for flashes and cut snapping | [exp02](exp02_beat_tracking.md) |
| faster-whisper `small.en` | Speech recognizer (OpenAI Whisper weights, CTranslate2 runtime) | Encoder-decoder Transformer | Next-token cross-entropy on 680k h of weakly supervised speech (Radford et al. 2022) | Web audio + transcripts | *Only* as an independent reference for word onsets in exp03 | Reference noise is a stated limitation |
| Remotion + Three.js | Deterministic video renderer | React components rendered per frame in headless Chrome, WebGL via ANGLE | — | — | Drawing every frame | Automated checks ([exp04](exp04_render_verification.md)) |

## Glossary

- **Take**: one of the audio versions Suno returns for a single generation request (two per request here).
- **alignedWords / word timings**: Suno's list of sung words, each with start and end in seconds, produced by aligning our lyrics to the generated audio.
- **Coverage**: share of written lyric words exactly matched (after normalisation) to a Suno word flagged `success=true`.
- **hootCer**: Suno's per-take alignment-quality score; its name suggests a character error rate, so lower is better. The exact definition is undocumented.
- **Repair (of timings)**: our rule that moves a mid-line word whose start is implausibly early (word longer than 1.2 s, or a gap longer than 0.6 s before the next word in the same line) to just before the next word.
- **Onset**: the time a word or sound begins.
- **Beat / downbeat**: the regular pulse of the music, and the first beat of each bar (assumed 4 beats per bar here).
- **Hop size**: the number of audio samples between successive analysis frames. Smaller hops give finer time resolution (256 samples at 22.05 kHz is 11.6 ms).
- **Tempogram tempo vs median beat spacing**: two tempo estimates. The first is quantized to whole frame lags. The second is 60 / median(time between tracked beats).
- **F-measure (±70 ms)**: harmonic mean of precision (detected beats that are real) and recall (real beats that were detected), counting a hit when a detected beat lies within 70 ms of a true beat.
- **95% CI**: confidence interval, a range that would contain the true mean in 95% of repeated experiments (t-interval) or, for medians, a bootstrap percentile range.
- **Wilcoxon signed-rank test**: a non-parametric paired test of whether one condition's errors are systematically smaller than another's.
- **Remotion composition / Sequence**: a video defined as React components. A `<Sequence>` places a component at a frame range.
- **Determinism**: rendering frame *n* always gives the same image, which is required because frames render in parallel browser tabs.
