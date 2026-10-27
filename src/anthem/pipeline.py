"""Pipeline wrapper: runs the anthem phases in order.

Local: parses the CLI, sets up timestamped logging, and calls each phase as one
clearly named imported function, timing each.
Global context: this is the only file a user runs (`uv run anthem`); each phase lives
in its own module and the phases communicate through files on disk
(data/song -> video/public -> out/), so any stage can be re-run alone with --stage.
Sources: argparse https://docs.python.org/3/library/argparse.html
"""

import argparse  # command-line flags
import json  # read the timeline for verification
import logging  # phase logging
import time  # phase timings
from contextlib import contextmanager  # timing context manager

from anthem.config import load_settings  # .env -> Settings
from anthem.logging_setup import setup_logging  # timestamped terminal + file logs
from anthem.song import produce_song  # phase 1: Suno takes on disk
from anthem.timeline import produce_timeline  # phase 2: video/public/timeline.json
from anthem.render import render_video  # phase 3: out/anthem.mp4
from anthem.verify import verify_video  # phase 4: checks + stills

log = logging.getLogger("anthem.pipeline")  # stable name in logs

STAGES = ["song", "timeline", "render", "verify"]  # ordered phases


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
    p.add_argument("--replace-lines", nargs=2, type=int, metavar=("FIRST", "LAST"), default=None,
                   help="pay to re-sing lyric lines FIRST..LAST (0-based) of the cached take with the current lyrics")
    p.add_argument("--resume-task", default=None, help="with --replace-lines: cache this already paid replace "
                                                         "task instead of submitting a new one")
    p.add_argument("--take", default=None, help="force a take by (prefix of) its Suno audio id")
    p.add_argument("--preview", action="store_true", help="render/verify only 30 s at half size")
    return p.parse_args(argv)


def run(args: argparse.Namespace) -> None:
    """Local: execute the selected stages.  Global: the end-to-end data flow of the project."""
    settings = load_settings(require_key=False)  # key is checked only if a paid generation is needed
    log_path = setup_logging(settings.logs_dir)  # logs/run_<ts>.log
    log.info("Run log: %s | args: %s", log_path, vars(args))  # where to look afterwards
    wanted = STAGES if args.stage == "all" else [args.stage]  # stage filter
    if "song" in wanted:
        with phase("song"):
            produce_song(settings, regenerate=args.regenerate_song, replace=args.replace_lines,
                         forced_take=args.take, resume_task=args.resume_task)  # Suno -> data/song/
    if "timeline" in wanted:
        with phase("timeline"):
            produce_timeline(settings, forced_take=args.take)  # data/song/ -> video/public/
    video = settings.out_dir / ("anthem_preview.mp4" if args.preview else "anthem.mp4")  # render output
    if "render" in wanted:
        with phase("render"):
            video = render_video(settings.video_dir, settings.out_dir, settings.render_concurrency, args.preview)
    if "verify" in wanted and not args.preview:  # a 30 s preview cannot match the song length
        with phase("verify"):
            timeline = json.loads((settings.video_dir / "public" / "timeline.json").read_text(encoding="utf-8"))
            report = verify_video(video, timeline, settings.out_dir / "stills")  # probe + stills
            if not report["ok"]:
                raise SystemExit(f"Verification failed: {report['problems']}")  # non-zero exit for CI/users


def main(argv=None) -> None:
    """Local: console-script entry point.  Global: `uv run anthem` lands here (see pyproject [project.scripts])."""
    run(parse_args(argv))  # parse + execute


if __name__ == "__main__":
    main()  # allow `python -m anthem.pipeline`
