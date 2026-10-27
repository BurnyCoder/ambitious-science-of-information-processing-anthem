"""Minimal client for the sunoapi.org Suno API.

Local: wraps the five endpoints the pipeline needs (credit balance, generate, replace section,
poll task, timestamped lyrics) plus a CDN download, checks the {code, msg, data} envelope, and
logs every request body and response in full (the API key is only ever in a header
that is never logged).
Global context: song.py calls this client to turn content/ into two downloaded takes
plus word timings; nothing else in the pipeline talks to the network.
Sources:
- generate:            https://docs.sunoapi.org/suno-api/generate-music
- replace section:     https://docs.sunoapi.org/suno-api/replace-section
- poll / statuses:     https://docs.sunoapi.org/suno-api/get-music-generation-details
- timestamped lyrics:  https://docs.sunoapi.org/suno-api/get-timestamped-lyrics
- credits:             https://docs.sunoapi.org/suno-api/get-remaining-credits
- quickstart polling:  https://docs.sunoapi.org/suno-api/quickstart
- httpx client/stream: https://www.python-httpx.org/quickstart/#streaming-responses
"""

import logging  # request/response audit trail
import time  # default sleep + monotonic clock for polling
from dataclasses import dataclass  # normalized track record
from pathlib import Path  # download destination

import httpx  # HTTP client (sync)

from anthem.logging_setup import log_json  # full, untruncated JSON logging

log = logging.getLogger(__name__)  # module logger -> run log + terminal

FAILURE_STATUSES = {"CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"}  # documented
RATE_LIMIT_CODES = {405, 430}  # documented: rate limit exceeded / call frequency too high -> retry later


class SunoError(RuntimeError):
    """Local: an API-level failure (non-200 code or failed task).  Global: aborts the song phase with the API's reason."""

    def __init__(self, code: int | None, message: str):
        super().__init__(f"Suno API error {code}: {message}")  # readable message for logs/CLI
        self.code = code  # numeric code lets callers retry on rate limits


@dataclass(frozen=True)
class Track:
    """Local: one generated take, field names unified.  Global: song.py downloads audio_url/image_url."""

    id: str  # audioId, needed for timestamped lyrics
    audio_url: str  # MP3 on Suno's CDN (kept ~15 days)
    image_url: str | None  # cover art
    title: str | None  # title echoed back
    tags: str | None  # style tags echoed back
    duration: float | None  # seconds


def _pick(raw: dict, *names):
    """Local: first present, non-empty value among alternative field names.
    Global: the docs show both camelCase (audioUrl) and snake_case (audio_url) shapes."""
    return next((raw[n] for n in names if raw.get(n) not in (None, "")), None)  # None if none present


def normalize_track(raw: dict) -> Track:
    """Local: map either documented track shape onto Track.  Global: insulates the pipeline from API shape drift."""
    duration = _pick(raw, "duration")  # may be missing while streaming
    return Track(
        id=str(raw["id"]),  # required
        audio_url=_pick(raw, "audioUrl", "audio_url", "sourceAudioUrl", "source_audio_url"),  # final MP3
        image_url=_pick(raw, "imageUrl", "image_url", "sourceImageUrl", "source_image_url"),  # cover
        title=_pick(raw, "title"),
        tags=_pick(raw, "tags"),
        duration=float(duration) if duration is not None else None,  # numeric seconds
    )


class SunoClient:
    """Local: thin, logged wrapper over sunoapi.org.  Global: the only network boundary of the pipeline."""

    def __init__(self, api_key: str, base_url: str, http: httpx.Client | None = None):
        self._key = api_key  # kept private; only placed in the Authorization header
        self._http = http or httpx.Client(base_url=base_url, timeout=60.0)  # injectable for tests

    def _request(self, method: str, path: str, *, json: dict | None = None, params: dict | None = None):
        """Local: send one authenticated call, log it, unwrap the envelope, raise on errors.
        Global: every endpoint method below funnels through here, so logging and errors are uniform."""
        log_json(log, f"Suno request {method} {path}", {"params": params, "json": json})  # full prompt payload
        resp = self._http.request(method, path, json=json, params=params,  # auth only here, never on downloads
                                  headers={"Authorization": f"Bearer {self._key}"})
        try:
            body = resp.json()  # API always answers JSON
        except ValueError:  # e.g. HTML error page from a proxy
            raise SunoError(resp.status_code, resp.text[:2000]) from None  # keep a readable excerpt
        log_json(log, f"Suno response {method} {path} (HTTP {resp.status_code})", body)  # full output, untruncated
        if resp.status_code != 200 or body.get("code") != 200:  # documented: code 200 means success
            raise SunoError(body.get("code", resp.status_code), str(body.get("msg")))  # surface API reason
        return body.get("data")  # payload inside the envelope

    def credits(self) -> int:
        """Local: remaining credit balance.  Global: logged before every paid generation."""
        return int(self._request("GET", "/api/v1/generate/credit"))  # data is an integer

    def generate(self, *, lyrics: str, style: str, title: str, model: str, duration: int,
                 negative_tags: str, vocal_gender: str, callback_url: str) -> str:
        """Local: submit one custom-mode, sung generation; returns taskId.
        Global: the single paid call of the pipeline (it yields two takes)."""
        payload = {  # field names exactly as in the generate-music docs
            "customMode": True,  # we supply our own lyrics, style and title
            "instrumental": False,  # vocals required for word-synced lyrics
            "model": model,
            "lyrics": lyrics,  # V6 lyrics field (max 5000 chars)
            "prompt": lyrics,  # in custom mode prompt is also "used as lyrics"; fallback if lyrics is ignored
            "style": style,
            "title": title,
            "negativeTags": negative_tags,
            "vocalGender": vocal_gender,
            "duration": duration,  # API default is only 20 s
            "callBackUrl": callback_url,  # marked required in the OpenAPI schema; we poll anyway
        }
        return self._request("POST", "/api/v1/generate", json=payload)["taskId"]  # documented: data.taskId

    def replace_section(self, *, task_id: str, audio_id: str, segment_lyrics: str, full_lyrics: str, tags: str,
                        title: str, start_s: float, end_s: float, negative_tags: str, vocal_gender: str,
                        callback_url: str) -> str:
        """Local: re-sing [start_s, end_s] of an existing take with new segment lyrics; returns taskId.
        Global: paid lyric fix that keeps the rest of the song (polled with wait_for like generate)."""
        payload = {  # field names exactly as in https://docs.sunoapi.org/suno-api/replace-section
            "taskId": task_id, "audioId": audio_id,  # "existing audio" mode: the parent task + take
            "prompt": segment_lyrics, "lyrics": segment_lyrics,  # lyrics of the replaced segment only
            "fullLyrics": full_lyrics,  # complete song lyrics after the change
            "tags": tags, "title": title, "negativeTags": negative_tags, "vocalGender": vocal_gender,
            "infillStartS": round(start_s, 2), "infillEndS": round(end_s, 2),  # 2 decimals, >= 10 s apart
            "callBackUrl": callback_url,  # we poll anyway
        }
        return self._request("POST", "/api/v1/generate/replace-section", json=payload)["taskId"]  # data.taskId

    def record_info(self, task_id: str) -> dict:
        """Local: one status poll.  Global: wait_for() calls this until SUCCESS."""
        return self._request("GET", "/api/v1/generate/record-info", params={"taskId": task_id})

    def wait_for(self, task_id: str, poll_interval: float, timeout: float, sleep=time.sleep, clock=time.monotonic):
        """Local: poll until SUCCESS (all tracks done), a failure status, or timeout; returns Tracks.
        Global: blocks the song phase while Suno renders; sleep/clock are injectable for tests."""
        deadline = clock() + timeout  # absolute give-up time
        while True:
            try:
                info = self.record_info(task_id)  # current task state
            except SunoError as err:
                if err.code not in RATE_LIMIT_CODES:  # only rate limits are worth retrying
                    raise
                log.warning("Rate limited (%s); retrying after %ss", err.code, poll_interval)  # back off
                info = {}  # treat as still pending
            status = info.get("status")  # PENDING / TEXT_SUCCESS / FIRST_SUCCESS / SUCCESS / failures
            log.info("Task %s status: %s", task_id, status)  # progress line
            if status == "SUCCESS":  # all takes finished
                response = info.get("response") or {}  # container of tracks
                raw = response.get("sunoData") or response.get("data") or []  # both documented shapes
                return [normalize_track(t) for t in raw]  # unified Track objects
            if status in FAILURE_STATUSES or (status or "").endswith(("FAILED", "ERROR")):  # documented failures
                raise SunoError(info.get("errorCode"), f"{status}: {info.get('errorMessage')}")  # stop, report why
            if clock() >= deadline:  # no result in time
                raise TimeoutError(f"Suno task {task_id} not finished after {timeout}s (last status {status})")
            sleep(poll_interval)  # wait before the next poll

    def timestamped_lyrics(self, task_id: str, audio_id: str) -> dict:
        """Local: word-level timings for one take (alignedWords, hootCer, waveformData).
        Global: the alignment phase maps these onto the written lyric lines for karaoke sync."""
        return self._request("POST", "/api/v1/generate/get-timestamped-lyrics",
                             json={"taskId": task_id, "audioId": audio_id})  # both ids required

    def download(self, url: str, path: Path) -> None:
        """Local: stream a CDN file to disk without the Authorization header.
        Global: saves takes/covers before Suno's ~15-day retention expires."""
        path.parent.mkdir(parents=True, exist_ok=True)  # ensure destination dir
        with self._http.stream("GET", url, follow_redirects=True) as resp:  # absolute URL bypasses base_url
            resp.raise_for_status()  # fail loudly on 4xx/5xx
            with path.open("wb") as fh:  # binary write
                for chunk in resp.iter_bytes():  # constant memory for large files
                    fh.write(chunk)
        log.info("Downloaded %s -> %s (%d bytes)", url, path, path.stat().st_size)  # audit trail
