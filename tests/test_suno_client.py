"""Tests for anthem.suno_client.

Local: exercises the sunoapi.org HTTP client against an in-memory fake server
(httpx.MockTransport), so no credits are spent and no network is touched.
Global context: the song phase of the pipeline depends on this client to submit
the lyrics, poll the task until both takes exist, and fetch word timings; these
tests pin the request shape documented at https://docs.sunoapi.org/suno-api/generate-music
and the status machine documented at https://docs.sunoapi.org/suno-api/get-music-generation-details.
Source for the mocking approach: https://www.python-httpx.org/advanced/transports/#mock-transports
"""

import json  # decode request bodies captured by the fake server
import logging  # caplog captures log records to prove the key never leaks

import httpx  # MockTransport lets the client talk to a Python function instead of the network
import pytest  # fixtures + raises

from anthem.suno_client import SunoClient, SunoError, normalize_track  # unit under test

API_KEY = "test-key-0123456789abcdef"  # fake key; tests assert it is sent but never logged
BASE = "https://api.sunoapi.org"  # documented base URL (https://docs.sunoapi.org/)


def make_client(handler):
    """Local: build a SunoClient whose HTTP layer is the given fake handler.
    Global: every test uses this, so the client under test is identical to production
    except for the transport (dependency injection of httpx.Client)."""
    http = httpx.Client(base_url=BASE, transport=httpx.MockTransport(handler))  # route all calls to handler
    return SunoClient(api_key=API_KEY, base_url=BASE, http=http)  # same constructor production uses


def ok(data):
    """Local: wrap a payload in the sunoapi.org envelope {code, msg, data}.
    Global: every documented endpoint returns this envelope, code 200 meaning success."""
    return httpx.Response(200, json={"code": 200, "msg": "success", "data": data})  # documented envelope


def test_generate_sends_documented_custom_mode_payload_and_bearer_auth():
    seen = {}  # captures the single request the client makes

    def handler(request):
        seen["method"] = request.method  # expect POST
        seen["path"] = request.url.path  # expect /api/v1/generate
        seen["auth"] = request.headers.get("authorization")  # expect "Bearer <key>"
        seen["body"] = json.loads(request.content)  # the JSON payload
        return ok({"taskId": "task-123"})  # documented success shape

    client = make_client(handler)  # client wired to the fake server
    task_id = client.generate(  # submit one custom-mode song
        lyrics="[Verse]\nWe will know", style="epic anthem", title="We Will Know",
        model="V6", duration=240, negative_tags="lo-fi", vocal_gender="m",
        callback_url="https://example.com/cb",
    )
    assert task_id == "task-123"  # taskId is read from data.taskId
    assert seen["method"] == "POST" and seen["path"] == "/api/v1/generate"  # documented endpoint
    assert seen["auth"] == f"Bearer {API_KEY}"  # documented Bearer auth
    body = seen["body"]  # shorthand
    assert body["customMode"] is True and body["instrumental"] is False  # sung song with our own lyrics
    assert body["model"] == "V6" and body["duration"] == 240  # model + explicit length (API default is 20 s)
    assert body["lyrics"] == body["prompt"] == "[Verse]\nWe will know"  # V6 `lyrics`, plus `prompt` fallback
    assert body["style"] == "epic anthem" and body["title"] == "We Will Know"  # custom-mode fields
    assert body["negativeTags"] == "lo-fi" and body["vocalGender"] == "m"  # optional custom-mode fields
    assert body["callBackUrl"] == "https://example.com/cb"  # schema marks it required


def test_replace_section_sends_documented_payload():
    seen = {}  # captures the single request

    def handler(request):
        seen["path"], seen["body"] = request.url.path, json.loads(request.content)  # endpoint + payload
        return ok({"taskId": "task-r"})  # documented success shape

    task_id = make_client(handler).replace_section(  # re-sing 26.1-37.7 s of take a1 of task-1
        task_id="task-1", audio_id="a1", segment_lyrics="A thing", full_lyrics="[Verse]\nA thing", tags="epic",
        title="T", start_s=26.1049, end_s=37.7395, negative_tags="lo-fi", vocal_gender="m",
        callback_url="https://example.com/cb")
    body = seen["body"]  # shorthand
    assert task_id == "task-r" and seen["path"] == "/api/v1/generate/replace-section"  # documented endpoint
    assert body["taskId"] == "task-1" and body["audioId"] == "a1"  # "existing audio" mode
    assert body["prompt"] == body["lyrics"] == "A thing" and body["fullLyrics"] == "[Verse]\nA thing"
    assert body["infillStartS"] == 26.1 and body["infillEndS"] == 37.74  # rounded to 2 decimals as documented


def test_api_level_error_code_raises_with_message():
    client = make_client(lambda r: httpx.Response(200, json={"code": 429, "msg": "insufficient credits"}))  # documented 429
    with pytest.raises(SunoError) as exc:  # non-200 `code` must not be treated as success
        client.credits()  # any endpoint goes through the same envelope check
    assert exc.value.code == 429 and "insufficient credits" in str(exc.value)  # code + message preserved


def test_credits_returns_integer_balance():
    client = make_client(lambda r: ok(100))  # documented example: {"data": 100}
    assert client.credits() == 100  # data is the remaining balance


def record(status, tracks=None, shape="sunoData"):
    """Local: build a record-info payload with a given status and track list.
    Global: lets tests walk the documented PENDING -> TEXT_SUCCESS -> FIRST_SUCCESS -> SUCCESS machine."""
    return {"taskId": "task-123", "status": status, "response": {shape: tracks or []},  # docs show both shapes
            "errorMessage": None}  # populated only on failure


def test_wait_for_polls_until_success_and_normalizes_both_track_shapes():
    statuses = iter([  # successive poll answers, as the docs describe them
        record("PENDING"), record("TEXT_SUCCESS"), record("FIRST_SUCCESS"),
        record("SUCCESS", [
            {"id": "a1", "audioUrl": "https://cdn/a1.mp3", "imageUrl": "https://cdn/a1.jpg", "title": "T", "tags": "epic", "duration": 238.5},
            {"id": "a2", "audio_url": "https://cdn/a2.mp3", "image_url": "https://cdn/a2.jpg", "title": "T", "tags": "epic", "duration": 241.0},
        ]),
    ])
    paths = []  # every polled path, to check the endpoint and query

    def handler(request):
        paths.append(str(request.url))  # remember URL including ?taskId=
        return ok(next(statuses))  # next state in the machine

    sleeps = []  # injected sleep records intervals instead of waiting
    tracks = make_client(handler).wait_for("task-123", poll_interval=15, timeout=900, sleep=sleeps.append)
    assert [t.id for t in tracks] == ["a1", "a2"]  # both takes returned in order
    assert tracks[1].audio_url == "https://cdn/a2.mp3"  # snake_case shape normalized
    assert tracks[0].duration == 238.5  # numeric duration kept
    assert all("record-info?taskId=task-123" in p for p in paths)  # documented polling endpoint
    assert sleeps == [15, 15, 15]  # slept between the 4 polls, not after success


def test_wait_for_raises_on_documented_failure_status():
    failing = record("SENSITIVE_WORD_ERROR")  # documented: content contains prohibited words
    failing["errorMessage"] = "lyrics contain blocked words"  # failure detail
    client = make_client(lambda r: ok(failing))  # always fails
    with pytest.raises(SunoError, match="SENSITIVE_WORD_ERROR"):  # surfaced, not retried forever
        client.wait_for("task-123", poll_interval=1, timeout=10, sleep=lambda s: None)


def test_wait_for_times_out():
    clock = iter(range(0, 1000, 10))  # fake monotonic clock advancing 10 s per read
    client = make_client(lambda r: ok(record("PENDING")))  # never finishes
    with pytest.raises(TimeoutError):  # must stop at the timeout
        client.wait_for("task-123", poll_interval=10, timeout=30, sleep=lambda s: None, clock=lambda: next(clock))


def test_timestamped_lyrics_posts_task_and_audio_id():
    seen = {}  # captures request body

    def handler(request):
        seen["path"] = request.url.path  # expect documented endpoint
        seen["body"] = json.loads(request.content)  # expect {taskId, audioId}
        return ok({"alignedWords": [{"word": "We", "success": True, "startS": 1.0, "endS": 1.2, "palign": 0}],
                   "hootCer": 0.1, "waveformData": [], "isStreamed": False})  # documented response
    data = make_client(handler).timestamped_lyrics("task-123", "a1")  # fetch word timings for take a1
    assert seen["path"] == "/api/v1/generate/get-timestamped-lyrics"  # documented path
    assert seen["body"] == {"taskId": "task-123", "audioId": "a1"}  # both ids required
    assert data["alignedWords"][0]["startS"] == 1.0  # raw data returned for the alignment phase


def test_api_key_is_never_logged(caplog):
    caplog.set_level(logging.DEBUG)  # capture everything the client logs
    client = make_client(lambda r: ok({"taskId": "task-123"}))  # any successful call
    client.generate(lyrics="x", style="y", title="z", model="V6", duration=30,
                    negative_tags="", vocal_gender="m", callback_url="https://example.com/cb")
    assert caplog.text  # requests and responses were logged in full
    assert API_KEY not in caplog.text  # but the secret never was


def test_normalize_track_handles_missing_optional_fields():
    track = normalize_track({"id": "a3", "audioUrl": "https://cdn/a3.mp3"})  # minimal valid track
    assert track.id == "a3" and track.image_url is None and track.duration is None  # optional fields default
