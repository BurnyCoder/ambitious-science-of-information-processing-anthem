"""Tests for anthem.song (the song phase).

Local: checks loading the song spec from content/ and the generate-or-reuse cache,
using a fake Suno client so no credits are spent.
Global context: this phase turns content/lyrics.txt + content/song.toml into two
downloaded takes plus their word timings; later phases only read its cache file.
"""

import json  # read the cache file

import pytest  # tmp_path fixture + raises

from anthem.config import load_settings  # real Settings, rooted in tmp_path
from anthem.song import SpecError, generate_or_load_song, load_song_spec, replace_lines  # units under test
from anthem.suno_client import SunoError, Track  # error type + the normalized track type the fake returns


def write_content(root, title="We Will Know", lyrics="[Chorus]\nWe will know", extra=""):
    """Local: create a minimal content/ folder.  Global: mirrors the real content/ layout."""
    content = root / "content"  # content dir under the project root
    content.mkdir(parents=True)  # fresh dir per test
    (content / "lyrics.txt").write_text(lyrics, encoding="utf-8")  # Suno-format lyrics
    (content / "song.toml").write_text(  # metadata in TOML (stdlib tomllib reads it)
        f'title = "{title}"\nstyle = "epic cinematic anthem"\nnegative_tags = "lo-fi"\nvocal_gender = "m"\n{extra}',
        encoding="utf-8")
    return content  # path for load_song_spec


class FakeClient:
    """Local: stands in for SunoClient and records calls.
    Global: lets the song phase be tested end to end without the network."""

    def __init__(self):
        self.generated = 0  # how many paid generations were requested

    def credits(self):
        return 500  # pretend balance

    def generate(self, **kwargs):
        self.generated += 1  # count paid calls
        self.kwargs = kwargs  # keep payload for assertions
        return "task-9"  # fake task id

    def wait_for(self, task_id, poll_interval, timeout):
        return [Track("a1", "https://cdn/a1.mp3", "https://cdn/a1.jpg", "We Will Know", "epic", 240.0),
                Track("a2", "https://cdn/a2.mp3", None, "We Will Know", "epic", 238.0)]  # two takes

    def timestamped_lyrics(self, task_id, audio_id):
        return {"alignedWords": [{"word": "We", "success": True, "startS": 1.0, "endS": 1.3}], "hootCer": 0.2}

    def download(self, url, path):
        path.write_bytes(b"fake:" + url.encode())  # write placeholder bytes instead of fetching


def test_load_song_spec_reads_toml_and_lyrics(tmp_path):
    spec = load_song_spec(write_content(tmp_path))  # parse content/
    assert spec.title == "We Will Know" and spec.style == "epic cinematic anthem"  # from song.toml
    assert spec.lyrics == "[Chorus]\nWe will know" and spec.vocal_gender == "m"  # lyrics file verbatim


def test_load_song_spec_enforces_documented_limits(tmp_path):
    with pytest.raises(SpecError, match="title"):  # V6 title max 80 chars
        load_song_spec(write_content(tmp_path, title="x" * 81))


def test_load_song_spec_rejects_banned_words(tmp_path):
    banned = 'banned_words = ["mind"]\n'  # content/song.toml list, checked before any paid call
    with pytest.raises(SpecError, match="mind"):  # any case, any suffix ("Mind's", "minds")
        load_song_spec(write_content(tmp_path / "bad", lyrics="[Verse]\nA Mind's eye", extra=banned))
    spec = load_song_spec(write_content(tmp_path / "ok", lyrics="[Verse]\nIt finds the minima", extra=banned))
    assert "minima" in spec.lyrics  # only whole-word prefixes match, so "minima" is allowed


def test_real_content_has_no_banned_words():
    from pathlib import Path  # repo root is two levels above this test file
    load_song_spec(Path(__file__).resolve().parents[1] / "content")  # raises SpecError if the guard is violated


def test_generate_then_reuse_cache(tmp_path):
    (tmp_path / ".env").write_text("SUNO_API_KEY=abc\n", encoding="utf-8")  # temp env
    settings = load_settings(env_file=tmp_path / ".env", root=tmp_path)  # rooted in tmp
    spec = load_song_spec(write_content(tmp_path))  # minimal spec
    client = FakeClient()  # fake Suno
    song = generate_or_load_song(settings, client, spec)  # first run: generate + download
    assert client.generated == 1 and song.task_id == "task-9"  # exactly one paid call
    assert client.kwargs["duration"] == 240 and client.kwargs["model"] == "V6"  # settings flow into payload
    assert [t.id for t in song.takes] == ["a1", "a2"]  # both takes kept
    assert song.takes[0].audio_path.read_bytes() == b"fake:https://cdn/a1.mp3"  # audio downloaded
    assert song.takes[1].image_path is None  # missing cover tolerated
    aligned = json.loads(song.takes[0].aligned_path.read_text(encoding="utf-8"))  # raw word timings saved
    assert aligned["alignedWords"][0]["word"] == "We"  # stored verbatim
    again = generate_or_load_song(settings, client, spec)  # second run
    assert client.generated == 1 and again.task_id == "task-9"  # cache reused, no new credits spent
    assert again.takes[0].audio_path == song.takes[0].audio_path  # same files


LINES = "[Verse]\nOne two\nThree four\nFive six"  # three lines; line 1 gets re-sung
WORDS = [("One", 1.0, 1.4), ("two", 1.6, 2.0), ("Three", 4.0, 4.4), ("four", 14.0, 14.4),
         ("Five", 16.0, 16.4), ("six", 16.6, 17.0)]  # Suno-style times: line 1 spans 4.0-14.4 s


class ReplaceClient(FakeClient):
    """Local: FakeClient whose takes carry per-line timings and whose replace_section is recorded.
    Global: tests the paid lyric-fix path without the network."""

    def __init__(self, durations=(240.0, 240.0)):
        super().__init__()
        self.durations, self.replaced = durations, None  # what wait_for returns / last replace payload

    def replace_section(self, **kwargs):
        self.replaced = kwargs  # payload for assertions
        return "task-r"  # fake replace task id

    def wait_for(self, task_id, poll_interval, timeout):
        return [Track(f"{task_id}-{i}", f"https://cdn/{task_id}-{i}.mp3", None, "T", "epic", d)
                for i, d in enumerate(self.durations)]  # takes of the given lengths

    def timestamped_lyrics(self, task_id, audio_id):
        return {"alignedWords": [{"word": w, "success": True, "startS": s, "endS": e} for w, s, e in WORDS],
                "hootCer": 0.1}


def _cached(tmp_path, client):
    """Local: settings + spec + one cached fake generation.  Global: the state --replace-lines starts from."""
    (tmp_path / ".env").write_text("SUNO_API_KEY=abc\n", encoding="utf-8")  # temp env (offset 0)
    settings = load_settings(env_file=tmp_path / ".env", root=tmp_path)  # rooted in tmp
    spec = load_song_spec(write_content(tmp_path, lyrics=LINES))  # three-line lyrics
    generate_or_load_song(settings, client, spec)  # cache task-9
    return settings, spec


def test_replace_lines_cuts_between_words_and_caches_with_parent(tmp_path):
    client = ReplaceClient()  # full-length takes come back
    settings, spec = _cached(tmp_path, client)
    song = replace_lines(settings, client, spec, 1, 1)  # re-sing "Three four"
    sent = client.replaced  # what would be paid for
    assert (sent["task_id"], sent["audio_id"], sent["segment_lyrics"]) == ("task-9", "task-9-0", "Three four")
    assert (sent["start_s"], sent["end_s"]) == (3.0, 15.2)  # gap midpoints (2.0+4.0)/2 and (14.4+16.0)/2
    assert sent["full_lyrics"] == LINES  # whole song after the change
    cache = json.loads((settings.song_dir / "song.json").read_text(encoding="utf-8"))  # new cache
    assert song.task_id == cache["task_id"] == "task-r"  # the edited song replaces the old one
    assert cache["parent"] == {"task_id": "task-9", "take_id": "task-9-0", "infill_s": [3.0, 15.2], "lines": [1, 1]}


def test_replace_lines_keeps_cache_if_result_is_not_full_length(tmp_path):
    client = ReplaceClient()  # the cached song is full length
    settings, spec = _cached(tmp_path, client)
    client.durations = (12.0, 12.0)  # but the replacement returns only the segment
    with pytest.raises(SunoError, match="song.json unchanged"):
        replace_lines(settings, client, spec, 1, 1)
    assert json.loads((settings.song_dir / "song.json").read_text(encoding="utf-8"))["task_id"] == "task-9"


def test_replace_lines_drops_takes_that_are_not_full_length(tmp_path):
    client = ReplaceClient()
    settings, spec = _cached(tmp_path, client)
    client.durations = (469.5, 240.0)  # what the real call returned: one doubled song, one edit
    song = replace_lines(settings, client, spec, 1, 1)
    cache = json.loads((settings.song_dir / "song.json").read_text(encoding="utf-8"))
    assert [t.id for t in song.takes] == [r["id"] for r in cache["takes"]] == ["task-r-1"]  # the full-length take
    assert [r["id"] for r in cache["dropped_takes"]] == ["task-r-0"]  # the other one is recorded, not used


def test_replace_lines_can_resume_a_paid_task_without_paying_again(tmp_path):
    client = ReplaceClient()
    settings, spec = _cached(tmp_path, client)
    song = replace_lines(settings, client, spec, 1, 1, resume_task="task-paid")  # caching step only
    assert client.replaced is None and song.task_id == "task-paid"  # no new replace call


def test_replace_lines_rejects_windows_under_10_s(tmp_path):
    client = ReplaceClient()
    settings, spec = _cached(tmp_path, client)
    with pytest.raises(SpecError, match="replace-section needs"):  # line 0 spans only 0.0-3.0 s
        replace_lines(settings, client, spec, 0, 0)
    assert client.replaced is None  # nothing was paid for
