# Architecture

The pipeline has four phases. `src/anthem/pipeline.py` calls each one as a function, and the phases hand data to each other only through files. Every phase can therefore be re-run on its own with `uv run anthem --stage <name>`.

| Phase | Module (entry function) | Reads | Writes | Network |
|---|---|---|---|---|
| `song` | `song.produce_song` | `content/song.toml`, `content/lyrics.txt` | `data/song/<taskId>/take*.mp3`, `*.jpg`, `*_aligned.json`, `data/song/song.json` | sunoapi.org (paid only if there is no cache, or with `--regenerate-song` / `--replace-lines`) |
| `timeline` | `timeline.produce_timeline` | the cache above, `content/scenes.toml`, `content/vignettes.toml` | `video/public/timeline.json`, `video/public/anthem.mp3` | none |
| `render` | `render.render_video` | `video/` (Remotion project) + the files above | `out/anthem.mp4` (`out/anthem_preview.mp4` with `--preview`) | none (Google Fonts are fetched at render time) |
| `verify` | `verify.verify_video` | `out/anthem.mp4`, `timeline.json` | `out/anthem_verify.json`, `out/stills/verify_s*.png` | none |

## Python modules (`src/anthem/`)

| Module | Responsibility |
|---|---|
| `config.py` | Loads `.env` (environment variables take precedence) into a frozen `Settings` and derives every path from the project root. Includes `VIDEO_WORD_OFFSET_S` (default 0), the exp05 word-time correction. |
| `logging_setup.py` | Writes timestamped logs to the terminal and to `logs/run_<ts>.log`. `log_json` writes whole payloads, never truncated. |
| `suno_client.py` | The only network boundary. Implements credit, generate, replace-section, record-info polling, timestamped lyrics and a CDN download (the download carries no auth header). |
| `song.py` | Loads and validates the song spec (V6 limits, `banned_words`), then runs generate-or-reuse with the cache. `replace_lines` (`--replace-lines FIRST LAST`) re-sings lines of the cached take: the window runs from gap midpoint to gap midpoint around those lines, in audio time (exp05 offset applied). The result replaces `song.json`, which records the edit under `parent`, but only if every returned take is full length. |
| `lyrics.py` | Parses `[Section]` tags, numbers repeated sections, and marks `(backing)` words. |
| `alignment.py` | Aligns Suno `alignedWords` to the written words using difflib, interpolates missing words, and repairs grossly misplaced words. Repair v2 moves only mid-line words longer than 3 s, plus the chain of words before them; see reports/exp03. |
| `take_selection.py` | Picks a take by a rule fixed before generation: highest coverage, then lowest `hootCer`. |
| `audio_analysis.py` | Uses librosa for beats (hop 256), tempo from the median beat spacing, a 4/4 downbeat-phase heuristic, and RMS and onset strength sampled per video frame. |
| `timeline.py` | Shifts every word by `VIDEO_WORD_OFFSET_S` (`shift_words`, clamped at 0), snaps section boundaries to beats and writes `timeline.json`. Also computes the cut-to-beat metric. |
| `vignettes.py` | Places the illustration track. Each card in `content/vignettes.toml` starts 0.15 s before its trigger word is sung and is clipped at its section's end (no spill over the next scene). Cards sharing a lane never overlap, so the two lanes (a, b) cap the panels in a scene at two; lane `scene` cards are drawn by the scene itself and are never trimmed. A `[[clear]]` cue ends every earlier card of a section 0.5 s before a highlight word. Also computes card coverage (share of sung lines with a card). |
| `render.py` | Builds the `npx remotion render … --gl=angle` command and streams its output into the log. |
| `verify.py` | Runs the ffprobe acceptance checks and extracts one still per section with ffmpeg. |

## The `timeline.json` contract

`timeline.py` writes this file and `video/src/lib/timeline.ts` declares the same shape. It is the only interface between the Python side and the TypeScript side.

```jsonc
{
  "version": 4, "title": "We Will Know", "fps": 30, "audio": "anthem.mp3",
  "durationS": 240.42, "durationInFrames": 7213, "tempoBpm": 129.31,
  "sections": [{"index": 0, "label": "Intro", "kind": "intro", "occurrence": 1, "scene": "intro", "startS": 0.0, "endS": 18.6}],
  "lines": [{"index": 2, "sectionIndex": 1, "text": "A matrix and a bend, …", "startS": 18.808, "endS": 22.56, "backing": false,
             "words": [{"text": "A", "startS": 18.808, "endS": 18.968, "backing": false}]}],
  "beats": [4.946, …], "downbeats": […],
  "energy": [/* one 0..1 value per video frame */], "onset": [/* same */],
  "vignettes": [{"id": "matmul", "lane": "a", "sectionIndex": 1, "lineIndex": 2, "startS": 18.66, "endS": 24.66,
                 "title": "A matrix: the most general linear map", "text": "…", "badge": "live math", "cite": "…", "url": "…"}],
  "meta": {"taskId": "…", "takeId": "…", "alignment": {"coverage": 1.0, "repaired": 2}, "wordOffsetS": -0.137, "hootCer": 0.1546, "cutToBeatErrorS": 0.0, "vignetteCoverage": 1.0, "takeScores": […]}
}
```

- **Section boundaries.** The first section starts at 0. Every later section starts at its first sung word minus 0.1 s, snapped to the nearest beat if one is within ±0.3 s. Each section ends where the next one starts, and the last one ends at the end of the song.
- **Lines.** Each line runs from its first word's start to its last word's end.
- **Cards** (`vignettes`, schema version 4) start 0.15 s before their trigger word. Each one is clipped at its section's end, and the earlier of two cards in the same lane ends where the later one starts. Version 3 replaced v2's screen `slots` with `lane`; version 4 makes `a`/`b` the scene's panel slots 0/1 (geometry in `video/src/stage/layout.json`), adds lane `scene` (drawn by the scene in place) and drops the spill past a cut. `badge` is one of `released data`, `published numbers`, `live math`, `from the paper`, `schematic`.
- **Word times** already include `meta.wordOffsetS` (−0.137 s for the shipped take 1; see reports/exp05). Section boundaries are computed from the shifted words.

## Remotion side (`video/`)

- `src/Root.tsx`: `calculateMetadata` fetches `timeline.json` and sets `fps`, `durationInFrames` and the `timeline` prop. The video length therefore always equals the song length.
- `src/World.tsx`: the video at the current frame (`useCurrentFrame()`), so it can be drawn live or frozen:
  - equation dust
  - one `<Sequence>` per section, each mounting `SCENES[section.scene]` (inside the punch/glitch layer)
  - the stage (`StageLayer`): the figure panels in the scene's slots, wired to their objects; the scene is never dimmed or pushed for a figure
  - giant words in the lower third (scenes whose layout band is `bigLyrics`) or the karaoke overlay
- `src/Anthem.tsx`: starfield background, spectrum ring (`visualizeAudio`), the world, beat/cut flashes, HUD, citation ticker, `<Audio>`. During the outro's sung part the world is replaced by the rewind: up to two `<Freeze frame>` copies of `World` at earlier moments (`stage/rewind.ts`), the live outro karaoke, the outro's figures as headline plates, and a HUD reading `◀◀ REWIND` with the source time. Where the rewind lands (the last downbeat before the last word), the overview (`stage/OverviewLayer.tsx`) is drawn under the live `World`, whose `OutroScene` puts the token, the statement and the credits in the mosaic's free centre.
- `src/lib/timeline.ts`: pure helpers such as `lineAt`, `activeWordIndex`, `beatPulse`, `wordTime` and `featureAt`. Every visual is a pure function of the frame number, which is Remotion's rendering model, so renders are deterministic.
- `src/stage/`: the figure cards inside the scenes.
  - `layout.json` (+ `layout.ts`): per scene, two panel slots, the protected regions no panel may cover (its key objects) and its lyric band; the single source read by TypeScript, `scripts/analysis/shots.py` and `tests/test_layout.py`.
  - `shots.ts`: the lifecycle as a pure function of t. A panel emerges from its object (0.4 s), stays in its slot for its whole time, and docks 0.5 s after its end until its section ends; `cardsOn` gives scenes their own (lane `scene`) cards. Tested in `tests/shots.test.ts`.
  - `anchors.ts`: the object each panel belongs to and docks into, per scene, from geometry the scenes export (`rungAnchor`, `PLOT`, `projectStar` with `sphereGrow`, `chorusAnchor`, `manifoldAnchor`, `landscapeAnchor`).
  - `Shot.tsx`: `CardFace` (kinetic title, body, caption, lower third FIG · badge · citation; scenes reuse it) and the panel on a plate in the scene's accent.
  - `StageLayer.tsx`: connector lines and anchor rings, then the panels (docked thumbnails underneath); optional layout debug overlay.
  - `rewind.ts`: the outro's rewind schedule: beat-grid cuts from 1 beat to 1/4 beat, each playing an earlier moment backwards at 2× to 12×, the last one landing on the intro's token at the landing downbeat. Tested in `tests/rewind.test.ts`.
  - `overview.ts` (pure) and `OverviewLayer.tsx`: the finale's mosaic. Ten tiles, one per earlier section, each a `<Freeze>` copy of `World` at the section's richest moment (most cards on screen) playing on at half speed, fly out of the token into a 4 × 3 grid whose two centre cells stay free; around them gold rays, the orbiting figure titles, downbeat fireworks, ARC-palette confetti and glitter, all seeded functions of the frame. Tested in `tests/overview.test.ts`. (The two files differ by more than case because Windows paths are case-insensitive.)
- `src/vignettes/`: the card bodies. `primitives.tsx` holds SVG primitives (`Plot` drawn with `evolvePath`, `Heatmap`, `Graph`, `Bars`, `Formula`); one file per song section holds the bodies; `index.ts` maps card ids to bodies (unknown ids fall back to the formula card). Released data comes from `public/vignettes/*.json` (written by `scripts/vignette_data.py`), live math from `src/lib/mathviz.ts`. Scenes reuse card data (for example the finale's bit rain uses `BITS`/`PROGRAM`, the chorus token row uses `OUTPUTS`).
- `src/components/Overlays.tsx`: starfield, equation dust (`@remotion/noise`), spectrum ring, beat/cut flashes, HUD and the citation ticker. `World.tsx` punch-zooms the scene layer on downbeats and RGB-splits it for 0.25 s after each cut.
- `src/components/three.tsx`: `<ThreeCanvas>` wrapper, frame-driven camera rig, additive glow points and lines, and `projectToScreen` (THREE's own camera projection) for 2D labels that stick to 3D objects. The geometry is rebuilt each frame from plain arrays.
- `scripts/vocal_energy.py`: the per-frame vocal envelope of the chosen take (RMS of exp06's Demucs vocal stem, same `frame_rms` as the song's energy track, smoothed over 0.4 s) → `public/vignettes/vocal_energy.json`, which sizes the atlas sphere.
- `scripts/stills.mjs`: bundles once, then renders chosen frames (by default each section's midpoint) to `out/stills/`. `--vignettes` renders every card 1.6 s after it appears, `--docks` every section just before it ends, and `--layout` overlays each scene's slots, protected regions and bands.

## Design choices

- **Files between phases, not in-memory objects.** Phases can be re-run separately, and the one paid step (`song`) is cached.
- **Timeline in seconds, converted to frames only in TypeScript.** The Python side does not depend on fps. `durationInFrames` is the only precomputed frame count.
- **Audio features precomputed in Python** (energy and onset per frame). Scenes can react to the music without decoding audio. The spectrum ring is the only consumer of decoded audio (`useAudioData`).
- **Scene ids configured in `content/scenes.toml`.** Changing which visual plays in which section needs no code change.
