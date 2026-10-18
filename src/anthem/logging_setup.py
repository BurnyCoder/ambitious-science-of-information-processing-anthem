"""Timestamped logging to terminal and to logs/run_<timestamp>.log.

Local: configures the root logger once with two handlers (stderr + UTF-8 file) using
millisecond timestamps, and offers log_json() to dump whole JSON payloads untruncated.
Global context: every phase logs through `logging.getLogger(__name__)`, so the run log
holds the complete Suno requests/responses (the "prompts and outputs" of the generative
model), subprocess output from Remotion, and phase timings in one chronological file.
Sources:
- logging handlers/formatters: https://docs.python.org/3/howto/logging-cookbook.html#logging-to-multiple-destinations
- msecs in format strings: https://docs.python.org/3/library/logging.html#logrecord-attributes
"""

import json  # pretty-print payloads in full
import logging  # stdlib logging framework
import sys  # stderr stream for the terminal handler
from datetime import datetime  # run-id timestamp for the log file name
from pathlib import Path  # log directory handling

FORMAT = "%(asctime)s.%(msecs)03d | %(levelname)-7s | %(name)s | %(message)s"  # e.g. 2026-10-18 18:30:01.123 | INFO | ...
DATEFMT = "%Y-%m-%d %H:%M:%S"  # ISO-like date, msecs appended by FORMAT


def setup_logging(logs_dir: Path, level: int = logging.INFO) -> Path:
    """Local: attach a terminal handler and a new timestamped file handler to the root logger.
    Global: called once at the start of pipeline.run(); returns the log path so it can be reported."""
    logs_dir.mkdir(parents=True, exist_ok=True)  # create logs/ on first run
    path = logs_dir / f"run_{datetime.now():%Y%m%d_%H%M%S}.log"  # one file per run
    root = logging.getLogger()  # root logger collects every module's records
    root.setLevel(level)  # threshold for all handlers
    for handler in list(root.handlers):  # idempotent: re-running in one process does not duplicate lines
        root.removeHandler(handler)  # drop stale handlers
    formatter = logging.Formatter(FORMAT, DATEFMT)  # shared timestamped format
    for handler in (logging.StreamHandler(sys.stderr), logging.FileHandler(path, encoding="utf-8")):  # terminal + file
        handler.setFormatter(formatter)  # same format in both places
        root.addHandler(handler)  # realtime: StreamHandler flushes per record, FileHandler too
    logging.getLogger("httpx").setLevel(logging.WARNING)  # httpx logs every request URL at INFO; we log our own
    return path  # caller logs where the file lives


def log_json(logger: logging.Logger, title: str, payload: object) -> None:
    """Local: log a complete JSON document under a title, never truncated.
    Global: used for every Suno request body and response so the log is a full audit trail."""
    text = json.dumps(payload, indent=2, ensure_ascii=False, default=str)  # full, human-readable, UTF-8
    logger.info("%s\n%s", title, text)  # one record, whole payload
