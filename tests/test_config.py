"""Tests for anthem.config.

Local: checks that settings come from a .env file, that defaults fill the optional
keys, and that a missing API key fails loudly.
Global context: every pipeline phase reads its parameters from the Settings object,
so a wrong default here would silently change the song or the video.
Source: python-dotenv dotenv_values() https://github.com/theskumar/python-dotenv#other-use-cases
"""

import pytest  # tmp_path + monkeypatch fixtures

from anthem.config import ConfigError, load_settings  # unit under test

ENV_KEYS = ["SUNO_API_KEY", "SUNO_API_BASE_URL", "SUNO_MODEL", "SONG_DURATION_S", "VIDEO_FPS",
            "VIDEO_WORD_OFFSET_S"]  # keys we isolate


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """Local: remove real environment variables so only the temp .env is read.
    Global: keeps the developer's real key out of every test."""
    for key in ENV_KEYS:  # each key the loader understands
        monkeypatch.delenv(key, raising=False)  # absent is fine


def test_loads_key_and_defaults(tmp_path):
    env = tmp_path / ".env"  # temporary env file
    env.write_text("SUNO_API_KEY=abc\n", encoding="utf-8")  # only the required key
    s = load_settings(env_file=env, root=tmp_path)  # load with project root = tmp dir
    assert s.suno_api_key == "abc"  # key read from file
    assert s.suno_base_url == "https://api.sunoapi.org"  # documented default base URL
    assert s.suno_model == "V6" and s.song_duration_s == 240 and s.fps == 30  # defaults
    assert s.word_offset_s == 0.0  # no word-time correction unless configured
    assert s.song_dir == tmp_path / "data" / "song"  # paths are relative to root


def test_overrides_from_env_file(tmp_path):
    env = tmp_path / ".env"  # temporary env file
    env.write_text("SUNO_API_KEY=abc\nSUNO_MODEL=V6_WILD\nSONG_DURATION_S=200\nVIDEO_FPS=24\nVIDEO_WORD_OFFSET_S=-0.137\n",
                   encoding="utf-8")
    s = load_settings(env_file=env, root=tmp_path)  # load overrides
    assert (s.suno_model, s.song_duration_s, s.fps, s.word_offset_s) == ("V6_WILD", 200, 24, -0.137)  # typed overrides


def test_missing_key_raises(tmp_path):
    env = tmp_path / ".env"  # env file without the key
    env.write_text("SUNO_MODEL=V6\n", encoding="utf-8")  # no SUNO_API_KEY
    with pytest.raises(ConfigError, match="SUNO_API_KEY"):  # actionable message
        load_settings(env_file=env, root=tmp_path)


def test_key_not_required_when_offline(tmp_path):
    s = load_settings(env_file=tmp_path / "missing.env", root=tmp_path, require_key=False)  # render-only runs
    assert s.suno_api_key == ""  # empty but allowed
