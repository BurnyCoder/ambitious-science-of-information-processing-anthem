# AGENTS.md: working notes for coding agents

The project overview is in [README.md](README.md). This file covers how to work on the code safely.

## Commands

```bash
uv sync                                   # Python env (.venv, Python 3.12)
cd video && npm install && cd ..          # Remotion env
uv run pytest -q                          # Python tests (no network, no credits)
cd video && npx tsc --noEmit              # TypeScript typecheck
uv run anthem                             # full pipeline (song is cached -> no credits)
uv run anthem --stage timeline            # rebuild video/public/timeline.json (offline)
uv run anthem --stage render --preview    # 30 s, half-size render to out/anthem_preview.mp4
cd video && node scripts/stills.mjs 2084  # render single frames to out/stills/ for inspection
cd video && npm run studio                # interactive Remotion Studio (http://localhost:3000)
uv run python scripts/validate_beats.py   # experiment 02 (beat tracker vs ground truth)
uv run --group analysis python scripts/validate_alignment.py  # experiment 03 (needs the analysis group)
uv run --group analysis python scripts/validate_onset_offset.py  # experiment 05 (Demucs + MMS_FA; run twice, see below)
uv run --group analysis python scripts/validate_lyric_edit.py    # experiment 06 (checks the --replace-lines edit)
```

## Invariants: do not break these

- **Never spend Suno credits by accident.** `uv run anthem` reuses `data/song/song.json`. Only `--regenerate-song`, `--replace-lines` or deleting the cache pays for anything. `--resume-task` makes no new replace call, but it re-fetches word timings, which cost about 1 credit for two takes. Tests use `httpx.MockTransport` or fakes.
- **No "mind" in the lyrics.** The author's rule is enforced by `banned_words` in `content/song.toml`; `load_song_spec` refuses violating lyrics before any paid call.
- **Never commit `.env` or log the key.** The key exists only in the `Authorization` header built inside `SunoClient._request`. CDN downloads deliberately send no auth header. `tests/test_suno_client.py::test_api_key_is_never_logged` guards this.
- **`timeline.json` is a contract.** If you change its shape in `src/anthem/timeline.py`, update `video/src/lib/timeline.ts` and `docs/architecture.md` in the same change.
- **Determinism.** Remotion renders frames in parallel tabs, so every visual must be a pure function of `useCurrentFrame()`. Use `random(seed)` from `remotion`, never `Math.random()`, and never R3F `useFrame`.
- **Take selection is pre-specified** as max coverage, then min `hootCer`. Do not change the rule to pick a "nicer" take. Use `--take <id-prefix>` and document the override.
- **Exp05 labels stay blind.** `scripts/validate_onset_offset.py` first writes blinded panels (`reports/figures/exp05_anchors/`) and a hidden key (`out/exp05/anchor_key.json`). Label the panels in `reports/data/exp05_anchor_labels.json` *before* opening the key or the comparison output, then run it again.
- **Experiment helpers live in `scripts/analysis/`** (imported by exp03 and exp05; pytest finds them via `pythonpath = ["scripts"]`). Heavy imports (torch, demucs, faster-whisper) stay inside functions so the tests run without the `analysis` group.
- **Logs are complete.** Suno requests and responses are logged untruncated via `log_json`. Keep it that way, because the reports cite them.

## Conventions

- Each module and function has a "Local:" / "Global:" docstring. Lines carry short comments, with links to the docs they are based on.
- Python phases live in their own modules. `pipeline.py` only orchestrates.
- Scenes live in `video/src/scenes/`, one file each, registered in `scenes/index.ts` and mapped in `content/scenes.toml`.
- Commits are small functional units on feature branches, merged through PRs.

## Where results are documented

- `reports/experiments.md`: summary of all experiments, glossary and tools table.
- `reports/exp0*_*.md`: one file per experiment. Raw data is in `reports/data/`.
- `reports/paper.md` and `reports/paper.pdf`: the technical report.
