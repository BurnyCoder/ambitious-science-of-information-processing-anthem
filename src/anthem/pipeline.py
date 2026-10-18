"""Pipeline wrapper: runs the anthem phases in order.

Local: parses the CLI, sets up timestamped logging, and calls each phase as one
clearly named function, timing each.
Global context: this is the only file a user runs (`uv run anthem`); each phase lives
in its own module and communicates through files on disk (data/song, video/public, out/),
so any stage can be re-run alone with --stage.
Sources: argparse https://docs.python.org/3/library/argparse.html
"""

import argparse  # command-line flags
import logging  # phase logging
import time  # phase timings
from contextlib import contextmanager  # timing context manager

from anthem.config import load_settings  # .env -> Settings
from anthem.logging_setup import setup_logging  # timestamped terminal + file logs
from anthem.song import generate_or_load_song, load_song_spec  # phase 1
from anthem.suno_client import SunoClient  # network boundary

log = logging.getLogger("anthem.pipeline")  # stable name in logs

STAGES = ["song"]  # ordered phases; later stages are appended as they land


@contextmanager
def phase(name: str):
    """Local: log start/end and wall time of one phase.  Global: makes the run log read like a table of contents."""
    log.info("=== Phase %s: start ===", name)  # banner
    t0 = time.perf_counter()  # high-resolution timer
    yield  # run the phase body
    log.info("=== Phase %s: done in %.1fs ===", name, time.perf_counter() - t0)  # duration


def parse_args(argv=None) -> argparse.Namespace:
    """Local: define CLI flags.  Global: lets users re-run single stages without spending credits."""
    p = argparse.ArgumentParser(prog="anthem", description="Generate the anthem song and its animated music video.")
    p.add_argument("--stage", choices=STAGES + ["all"], default="all", help="run one stage or all (default)")
    p.add_argument("--regenerate-song", action="store_true", help="pay for a new Suno generation even if cached")
    return p.parse_args(argv)


def run(args: argparse.Namespace) -> None:
    """Local: execute the selected stages.  Global: the end-to-end data flow of the project."""
    settings = load_settings()  # .env in the working directory
    log_path = setup_logging(settings.logs_dir)  # logs/run_<ts>.log
    log.info("Run log: %s | args: %s", log_path, vars(args))  # where to look afterwards
    wanted = STAGES if args.stage == "all" else [args.stage]  # stage filter
    if "song" in wanted:
        with phase("song"):
            spec = load_song_spec(settings.content_dir)  # hand-written lyrics + style
            client = SunoClient(settings.suno_api_key, settings.suno_base_url)  # real API
            song = generate_or_load_song(settings, client, spec, regenerate=args.regenerate_song)  # paid at most once
            log.info("Song task %s takes: %s", song.task_id, [t.audio_path.name for t in song.takes])


def main(argv=None) -> None:
    """Local: console-script entry point.  Global: `uv run anthem` lands here (see pyproject [project.scripts])."""
    run(parse_args(argv))  # parse + execute


if __name__ == "__main__":
    main()  # allow `python -m anthem.pipeline`
