# AGENTS.md: working notes for coding agents

The project overview is in [README.md](README.md). This file covers how to work on the code safely.

## Commands

```bash
uv sync                                   # Python env (.venv, Python 3.12)
cd video && npm install && cd ..          # Remotion env
uv run pytest -q                          # Python tests (no network, no credits)
cd video && npx tsc --noEmit              # TypeScript typecheck
cd video && npm test                      # mathviz known-answer tests + stage/shots.ts lifecycle tests (node --test, built-in type stripping)
uv run anthem                             # full pipeline (song is cached -> no credits)
uv run anthem --stage timeline            # rebuild video/public/timeline.json (offline)
uv run anthem --stage render --preview    # 30 s, half-size render to out/anthem_preview.mp4
cd video && node scripts/stills.mjs 2084  # render single frames to out/stills/ for inspection
cd video && node scripts/stills.mjs --vignettes 4  # one still per figure card, 1.6 s after it appears (optionally only some section indices)
cd video && node scripts/stills.mjs --layout      # section stills with each scene's slots, protected regions and bands overlaid
cd video && node scripts/stills.mjs --docks       # one still per section just before its end (all its cards docked)
cd video && npm run studio                # interactive Remotion Studio (http://localhost:3000)
uv run python scripts/validate_beats.py   # experiment 02 (beat tracker vs ground truth)
uv run --group analysis python scripts/validate_alignment.py  # experiment 03 (needs the analysis group)
uv run --group analysis python scripts/validate_onset_offset.py  # experiment 05 (Demucs + MMS_FA; run twice, see below)
uv run --group analysis python scripts/validate_lyric_edit.py    # experiment 06 (checks the --replace-lines edit)
uv run --group analysis python scripts/make_figures.py           # reports/figures/ (fig1 needs out/stills from a verify run)
uv run --group analysis python -I scripts/vignette_data.py       # experiment 07 data phase: released artifacts -> video/public/vignettes/ (~524 MB, once)
uv run python -I scripts/make_vignette_docs.py                   # regenerate docs/vignettes.md from timeline.json
uv run python -I scripts/validate_density.py                     # experiment 07 visual density (out/anthem.mp4 vs the v1.2.0 MP4 in out/v1.2.0/)
uv run python -I scripts/validate_density.py out/v1.3.0/we-will-know-anthem.mp4 out/anthem.mp4 --name exp08_density --margin 0.10  # exp08 non-inferiority
uv run python -I scripts/validate_unified.py                     # experiment 09 H1-H4 + descriptive (exp08's integration script is at tag v1.4.0)
uv run python -I scripts/validate_density.py out/v1.4.0/we-will-know-anthem.mp4 out/anthem.mp4 --name exp09_density --margin 0.10 --until 213.96  # exp09 H5
cd reports && pandoc paper.md -o paper.pdf --pdf-engine=xelatex -V mainfont=Cambria -V monofont=Consolas -V geometry:margin=1in
```

## Invariants: do not break these

- **Never spend Suno credits by accident.** `uv run anthem` reuses `data/song/song.json`. Only `--regenerate-song`, `--replace-lines` or deleting the cache pays for anything. `--resume-task` makes no new replace call, but it re-fetches word timings, which cost about 1 credit for two takes. Tests use `httpx.MockTransport` or fakes.
- **No "mind" in the lyrics.** The author's rule is enforced by `banned_words` in `content/song.toml`; `load_song_spec` refuses violating lyrics before any paid call.
- **Never commit `.env` or log the key.** The key exists only in the `Authorization` header built inside `SunoClient._request`. CDN downloads deliberately send no auth header. `tests/test_suno_client.py::test_api_key_is_never_logged` guards this.
- **`timeline.json` is a contract.** If you change its shape in `src/anthem/timeline.py`, update `video/src/lib/timeline.ts` and `docs/architecture.md` in the same change.
- **Determinism.** Remotion renders frames in parallel tabs, so every visual must be a pure function of `useCurrentFrame()`. Use `random(seed)` from `remotion`, never `Math.random()`, and never R3F `useFrame`.
- **Take selection is pre-specified** as max coverage, then min `hootCer`. Do not change the rule to pick a "nicer" take. Use `--take <id-prefix>` and document the override.
- **Exp05 labels stay blind.** `scripts/validate_onset_offset.py` first writes blinded panels (`reports/figures/exp05_anchors/`) and a hidden key (`out/exp05/anchor_key.json`). Label the panels in `reports/data/exp05_anchor_labels.json` *before* opening the key or the comparison output, then run it again.
- **Figure cards are data.** `content/vignettes.toml` holds every card (trigger word, lane, badge, citation; lane a/b = the scene's panel slot 0/1, lane `scene` = drawn by the scene); `anthem/vignettes.py` places them and pytest checks that every trigger is sung and every sung line has a card. Every card must carry a badge and a citation, and `banned_words` apply to card text too. Regenerate `docs/vignettes.md` after changing cards.
- **Reuse released results; never re-run an experiment whose data exists.** `scripts/vignette_data.py` downloads pinned files (original authors first, then well-known third parties) and records URL, revision, licence and sha256. Load downloaded `.pth` files with `weights_only=True` and pickles only through `analysis.external.load_numpy_pickle`. Never put text from the refusal-direction completions on screen.
- **Figures are part of their scene.** A panel card (lane a/b) goes only into its scene's slots in `video/src/stage/layout.json`, which must never overlap the scene's protected regions (its key objects) or the lyric bands; `tests/test_layout.py` enforces it. A panel stays in its slot for its whole time (>= 3 s, or >= 2.5 s when its trigger is within 3 s of a cut) and is wired to its object (`anchors.ts`); at most two per scene. Ideas a scene can draw itself go in lane `scene` and are drawn in place (`cardsOn`). Never dim, push or cover a scene's general picture for a figure, and never remove a general visual (the loss landscape with its SGD swarm, the tunnel, the network, the ladder...). Use `[[clear]]` to protect a highlight line.
- **The rewind is a pure schedule.** `stage/rewind.ts` decides every cut; `World.tsx` must stay a pure function of `useCurrentFrame()` so `<Freeze>` copies show the right moment, and `<Audio>`/the spectrum stay outside the Freeze.
- **`scripts/analysis/shots.py` mirrors `stage/shots.ts`** (constants read from the TypeScript, geometry from `layout.json`). If you change the lifecycle logic, change both and keep `tests/test_integration.py` and `video/tests/shots.test.ts` in step.
- **Experiment helpers live in `scripts/analysis/`** (imported by exp03 and exp05; pytest finds them via `pythonpath = ["scripts"]`). Heavy imports (torch, demucs, faster-whisper) stay inside functions so the tests run without the `analysis` group.
- **Logs are complete.** Suno requests and responses are logged untruncated via `log_json`. Keep it that way, because the reports cite them.

## Conventions

- Each module and function has a "Local:" / "Global:" docstring. Lines carry short comments, with links to the docs they are based on.
- Python phases live in their own modules. `pipeline.py` only orchestrates.
- Scenes live in `video/src/scenes/`, one file each, registered in `scenes/index.ts`, mapped in `content/scenes.toml`, laid out in `stage/layout.json`, and given a case in `stage/anchors.ts`. Scenes export the geometry the stage needs; they reuse card data from `src/vignettes/` instead of copying it.
- Commits are small functional units on feature branches, merged through PRs.

## Where results are documented

- `reports/experiments.md`: summary of all experiments, glossary and tools table.
- `reports/exp0*_*.md`: one file per experiment. Raw data is in `reports/data/`.
- `docs/vignettes.md`: the generated figure-card catalog with sources.
- `reports/paper.md` and `reports/paper.pdf`: the technical report.
