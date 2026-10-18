"""Pipeline configuration loaded from .env.

Local: turns key=value pairs from .env (plus real environment variables, which win)
into one typed, immutable Settings object, and derives every project path from the root.
Global context: pipeline.py loads Settings once and hands it to every phase
(song -> timeline -> render -> verify), so all knobs live in .env as the README describes.
Sources:
- python-dotenv dotenv_values(): https://github.com/theskumar/python-dotenv#other-use-cases
- frozen dataclasses: https://docs.python.org/3/library/dataclasses.html#frozen-instances
- defaults follow https://docs.sunoapi.org/ (base URL) and
  https://docs.sunoapi.org/suno-api/generate-music (model V6, duration 10-360 s)
"""

import os  # real environment variables override the .env file
from dataclasses import dataclass  # immutable typed settings container
from pathlib import Path  # OS-independent paths (Windows + POSIX)

from dotenv import dotenv_values  # parse .env without mutating os.environ


class ConfigError(RuntimeError):
    """Local: raised when a required setting is missing.  Global: stops the run before any paid call."""


@dataclass(frozen=True)
class Settings:
    """Local: every tunable value of the pipeline.  Global: passed to each phase function."""

    suno_api_key: str  # Bearer token for sunoapi.org (never logged)
    suno_base_url: str  # API host, e.g. https://api.sunoapi.org
    suno_model: str  # Suno model id, e.g. V6
    song_duration_s: int  # requested song length (custom mode only)
    poll_interval_s: int  # seconds between record-info polls
    timeout_s: int  # give up on a generation task after this many seconds
    callback_url: str  # schema-required callback URL (we poll instead)
    fps: int  # video frame rate used by the timeline + Remotion
    render_concurrency: int  # parallel Chrome tabs used by `remotion render`
    root: Path  # project root; all paths below hang off it

    @property
    def content_dir(self) -> Path:
        return self.root / "content"  # hand-written lyrics + song.toml

    @property
    def song_dir(self) -> Path:
        return self.root / "data" / "song"  # downloaded takes + raw Suno JSON (cache)

    @property
    def logs_dir(self) -> Path:
        return self.root / "logs"  # timestamped run logs

    @property
    def video_dir(self) -> Path:
        return self.root / "video"  # Remotion project

    @property
    def out_dir(self) -> Path:
        return self.root / "out"  # rendered MP4 + verification stills


def load_settings(env_file: Path | str = ".env", root: Path | str | None = None, require_key: bool = True) -> Settings:
    """Local: read env_file, overlay os.environ, apply defaults, validate the key.
    Global: the single entry point every phase uses to learn its parameters.
    require_key=False lets offline stages (timeline/render) run without a Suno key."""
    root = Path(root) if root is not None else Path.cwd()  # project root defaults to the working directory
    env = {k: v for k, v in dotenv_values(env_file).items() if v is not None}  # .env values (missing file -> {})
    env.update({k: v for k, v in os.environ.items() if k.startswith(("SUNO_", "SONG_", "VIDEO_", "RENDER_"))})  # env vars win
    key = env.get("SUNO_API_KEY", "").strip()  # required for any Suno call
    if require_key and not key:  # fail before spending anything
        raise ConfigError("SUNO_API_KEY is missing: copy .env.example to .env and set your sunoapi.org key")
    return Settings(  # typed conversion of every value, with documented defaults
        suno_api_key=key,
        suno_base_url=env.get("SUNO_API_BASE_URL", "https://api.sunoapi.org").rstrip("/"),  # no trailing slash
        suno_model=env.get("SUNO_MODEL", "V6"),  # current default model per the docs
        song_duration_s=int(env.get("SONG_DURATION_S", "240")),  # ~4 min anthem
        poll_interval_s=int(env.get("SUNO_POLL_INTERVAL_S", "15")),  # polite polling cadence
        timeout_s=int(env.get("SUNO_TIMEOUT_S", "900")),  # 15 min ceiling per task
        callback_url=env.get("SUNO_CALLBACK_URL", "https://example.com/suno-callback"),  # placeholder
        fps=int(env.get("VIDEO_FPS", "30")),  # 30 fps -> 7200 frames for a 4 min song
        render_concurrency=int(env.get("RENDER_CONCURRENCY", "8")),  # Remotion's default is half the CPU threads
        root=root,
    )
