# Suno API notes (sunoapi.org)

Suno has no official public API. This project uses the third-party provider **sunoapi.org**, which is documented at <https://docs.sunoapi.org/>.

## Endpoints used

Base URL: `https://api.sunoapi.org`. Every call sends `Authorization: Bearer <SUNO_API_KEY>`.

| Purpose | Call | Notes |
|---|---|---|
| Credit balance | `GET /api/v1/generate/credit` | Returns `data` as a number, e.g. `1000.0` in our run. |
| Generate | `POST /api/v1/generate` | See the payload below. Returns `data.taskId`. |
| Replace section | `POST /api/v1/generate/replace-section` | Re-sings `infillStartS`–`infillEndS` (≥ 10 s, ≤ 50 % of the track) of an existing take (`taskId` + `audioId`) with `prompt`/`lyrics` for the segment and `fullLyrics` for the whole song; `tags`, `title` required. Polled with record-info. Used once by `--replace-lines` ([exp06](../reports/exp06_lyric_edit.md)); see <https://docs.sunoapi.org/suno-api/replace-section>. |
| Poll | `GET /api/v1/generate/record-info?taskId=…` | Status goes `PENDING → TEXT_SUCCESS → FIRST_SUCCESS → SUCCESS`. Failures: `CREATE_TASK_FAILED`, `GENERATE_AUDIO_FAILED`, `CALLBACK_EXCEPTION`, `SENSITIVE_WORD_ERROR`. |
| Word timings | `POST /api/v1/generate/get-timestamped-lyrics` with body `{taskId, audioId}` | Returns `alignedWords[{word, success, startS, endS, palign}]`, `waveformData`, `hootCer` and `isStreamed`. |

**Payload sent** (custom mode). Field names follow <https://docs.sunoapi.org/suno-api/generate-music>:

```json
{"customMode": true, "instrumental": false, "model": "V6",
 "lyrics": "<content/lyrics.txt>", "prompt": "<same text>",
 "style": "<song.toml style>", "title": "We Will Know",
 "negativeTags": "…", "vocalGender": "m", "duration": 240,
 "callBackUrl": "https://example.com/suno-callback"}
```

- **`prompt` duplicates `lyrics`.** The docs say that in custom mode `prompt` "is used as lyrics" and that `lyrics` takes priority on V6. Sending both is a safe fallback.
- **`duration` must be set.** The docs list it as 10–360 s with a default of 20 s.
- **`callBackUrl` gets a placeholder.** The OpenAPI schema marks it as required, but we poll instead of using callbacks.
- **Limits** enforced in `song.py`: title ≤ 80 characters; style, lyrics and negativeTags ≤ 1000 / 5000 / 1000 characters. Lyrics containing a word from `banned_words` in `song.toml` (currently "mind") are refused before any call.

## Behaviour observed in our run

All of this is in `logs/` and `data/song/`.

- **Speed.** Generation took 62 s from submit to `SUCCESS`. It returned **2 takes** of 240.40 s and 239.92 s (`duration: 240` was requested).
- **Track field names.** The record-info track objects used camelCase (`audioUrl`, `imageUrl`). Some doc pages show snake_case (`audio_url`), so `normalize_track()` accepts both.
- **Downloads.** The audio URLs pointed to `tempfile.aiquickdraw.com` and the covers to `musicfile.removeai.ai`. The docs say files are retained for about 14–15 days, so the song phase downloads them immediately.
- **Aligned word strings** carry layout text: section tags and line breaks are glued onto words, as in `"[Verse 1]\nA "` or `"ooh)\n\n\n("`. `alignment.split_aligned_entries()` strips the tags and splits on whitespace.
- **The `success` flag** was `true` for all 431 and 439 entries, so it carries no information here. Coverage therefore ties at 1.0 and the tie-break (`hootCer`) decides between takes.
- **Timing artifacts.**
  - **Take 2** aligned the first lyric line twice: once compressed at 0.13–6.2 s and once at 13.3 s.
  - **Take 1** had intro backing vocals compressed into 10.7–11.4 s, and mid-line words with implausibly early starts, e.g. "matrix" spanning 7.74 s.
  - See [reports/exp03_alignment_repair.md](../reports/exp03_alignment_repair.md).
- **Replace section** ([exp06](../reports/exp06_lyric_edit.md)). One call, 2 min 2 s, about 6 credits including the two timing fetches:
  - It returned **two takes**: one 240.40 s edit, and one 469.52 s take that sings the song about twice and was dropped.
  - The record-info `tags` came back as "orchestral, cinematic, anthem", not our style text.
  - In the kept take, Suno regenerated about 16–46 s for a requested window of 25.97–37.60 s, and the whole file plays 17 ms earlier than the parent.
  - Its timestamped lyrics outside the window are identical to the parent's, i.e. not re-measured.
- **Tempo tag vs. measurement.** Suno's returned `tags` claim "124 BPM", but librosa measures a beat spacing of about 129 BPM on take 1. See [reports/exp02_beat_tracking.md](../reports/exp02_beat_tracking.md).

## Error handling

- **Envelope errors.** A response whose `code` is not 200 raises `SunoError(code, msg)`. Documented codes: 429 means insufficient credits; 405 and 430 mean rate-limited.
- **Rate limits** (405, 430) are retried during polling. Every other error aborts the run.
- **Failed word timings.** If fetching timestamped lyrics fails, the error is stored in place of the timings, and that take ranks last in take selection.
