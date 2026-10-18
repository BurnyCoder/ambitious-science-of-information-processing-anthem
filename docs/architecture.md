# Architecture

The pipeline has four phases. `src/anthem/pipeline.py` calls each one as a function, and the phases hand data to each other only through files. Every phase can therefore be re-run on its own with `uv run anthem --stage <name>`.

| Phase | Module (entry function) | Reads | Writes | Network |
|---|---|---|---|---|
| `song` | `song.produce_song` | `content/song.toml`, `content/lyrics.txt` | `data/song/<taskId>/take*.mp3`, `*.jpg`, `*_aligned.json`, `data/song/song.json` | sunoapi.org (paid only if there is no cache) |
| `timeline` | `timeline.produce_timeline` | the cache above, `content/scenes.toml` | `video/public/timeline.json`, `video/public/anthem.mp3` | none |
| `render` | `render.render_video` | `video/` (Remotion project) + the files above | `out/anthem.mp4` (`out/anthem_preview.mp4` with `--preview`) | none (Google Fonts are fetched at render time) |
| `verify` | `verify.verify_video` | `out/anthem.mp4`, `timeline.json` | `out/anthem_verify.json`, `out/stills/verify_s*.png` | none |

## Python modules (`src/anthem/`)

| Module | Responsibility |
|---|---|
| `config.py` | Loads `.env` (environment variables take precedence) into a frozen `Settings` and derives every path from the project root. |
| `logging_setup.py` | Writes timestamped logs to the terminal and to `logs/run_<ts>.log`. `log_json` writes whole payloads, never truncated. |
| `suno_client.py` | The only network boundary. Implements credit, generate, record-info polling, timestamped lyrics and a CDN download (the download carries no auth header). |
| `song.py` | Loads and validates the song spec (V6 limits), then runs generate-or-reuse with the cache. |
| `lyrics.py` | Parses `[Section]` tags, numbers repeated sections, and marks `(backing)` words. |
| `alignment.py` | Aligns Suno `alignedWords` to the written words using difflib, interpolates missing words, and repairs grossly misplaced words. Repair v2 moves only mid-line words longer than 3 s, plus the chain of words before them; see reports/exp03. |
| `take_selection.py` | Picks a take by a rule fixed before generation: highest coverage, then lowest `hootCer`. |
| `audio_analysis.py` | Uses librosa for beats (hop 256), tempo from the median beat spacing, a 4/4 downbeat-phase heuristic, and RMS and onset strength sampled per video frame. |
| `timeline.py` | Snaps section boundaries to beats and writes `timeline.json`. Also computes the cut-to-beat metric. |
| `render.py` | Builds the `npx remotion render … --gl=angle` command and streams its output into the log. |
| `verify.py` | Runs the ffprobe acceptance checks and extracts one still per section with ffmpeg. |

## The `timeline.json` contract

`timeline.py` writes this file and `video/src/lib/timeline.ts` declares the same shape. It is the only interface between the Python side and the TypeScript side.

```jsonc
{
  "version": 1, "title": "We Will Know", "fps": 30, "audio": "anthem.mp3",
  "durationS": 240.42, "durationInFrames": 7213, "tempoBpm": 129.31,
  "sections": [{"index": 0, "label": "Intro", "kind": "intro", "occurrence": 1, "scene": "intro", "startS": 0.0, "endS": 18.6}],
  "lines": [{"index": 2, "sectionIndex": 1, "text": "A matrix and a bend, …", "startS": 18.808, "endS": 22.56, "backing": false,
             "words": [{"text": "A", "startS": 18.808, "endS": 18.968, "backing": false}]}],
  "beats": [4.946, …], "downbeats": […],
  "energy": [/* one 0..1 value per video frame */], "onset": [/* same */],
  "meta": {"taskId": "…", "takeId": "…", "alignment": {"coverage": 1.0, "repaired": 2}, "hootCer": 0.1546, "cutToBeatErrorS": 0.0, "takeScores": […]}
}
```

- **Section boundaries.** The first section starts at 0. Every later section starts at its first sung word minus 0.1 s, snapped to the nearest beat if one is within ±0.3 s. Each section ends where the next one starts, and the last one ends at the end of the song.
- **Lines.** Each line runs from its first word's start to its last word's end.

## Remotion side (`video/`)

- `src/Root.tsx`: `calculateMetadata` fetches `timeline.json` and sets `fps`, `durationInFrames` and the `timeline` prop. The video length therefore always equals the song length.
- `src/Anthem.tsx`: stacks the layers in this order:
  - starfield background
  - spectrum ring (`visualizeAudio`)
  - one `<Sequence>` per section, each mounting `SCENES[section.scene]`
  - karaoke overlay (hidden in `bigLyrics` scenes)
  - beat/cut flashes
  - HUD
  - `<Audio>`
- `src/lib/timeline.ts`: pure helpers such as `lineAt`, `activeWordIndex`, `beatPulse`, `wordTime` and `featureAt`. Every visual is a pure function of the frame number, which is Remotion's rendering model, so renders are deterministic.
- `src/components/three.tsx`: `<ThreeCanvas>` wrapper, frame-driven camera rig, and additive glow points and lines. The geometry is rebuilt each frame from plain arrays.
- `scripts/stills.mjs`: bundles once, then renders chosen frames (by default each section's midpoint) to `out/stills/`.

## Design choices

- **Files between phases, not in-memory objects.** Phases can be re-run separately, and the one paid step (`song`) is cached.
- **Timeline in seconds, converted to frames only in TypeScript.** The Python side does not depend on fps. `durationInFrames` is the only precomputed frame count.
- **Audio features precomputed in Python** (energy and onset per frame). Scenes can react to the music without decoding audio. The spectrum ring is the only consumer of decoded audio (`useAudioData`).
- **Scene ids configured in `content/scenes.toml`.** Changing which visual plays in which section needs no code change.
