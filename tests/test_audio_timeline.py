"""Tests for anthem.audio_analysis and anthem.timeline.

Local: grounds the beat tracker on a synthetic click track with a known tempo
(ground truth by construction), and checks the timeline JSON the video reads.
Global context: beats drive the flashes/cuts and the timeline is the only contract
between the Python pipeline and the Remotion video.
Sources: librosa.clicks https://librosa.org/doc/latest/generated/librosa.clicks.html ,
soundfile.write https://python-soundfile.readthedocs.io/en/latest/#soundfile.write
"""

import numpy as np  # synthetic signals
import librosa  # click synthesis
import pytest  # approx
import soundfile as sf  # write the WAV fixture

from anthem.alignment import align_words  # word timings for the timeline
from anthem.audio_analysis import analyze_audio  # unit under test
from anthem.lyrics import parse_lyrics  # sections for the timeline
from anthem.timeline import build_timeline, shift_words, snap_to_beat  # units under test

SR = 22050  # librosa's default sample rate


@pytest.fixture
def click_track(tmp_path):
    """Local: 20 s of clicks every 0.5 s (120 BPM) plus faint noise.  Global: known-answer audio."""
    times = np.arange(0.5, 20.0, 0.5)  # ground-truth beat times
    y = librosa.clicks(times=times, sr=SR, length=20 * SR)  # 1 kHz clicks at those times
    y = y + 0.001 * np.random.default_rng(0).standard_normal(len(y))  # deterministic noise floor
    path = tmp_path / "clicks.wav"  # temp WAV
    sf.write(path, y, SR)  # 16-bit PCM by default
    return path, times


def test_beat_tracker_recovers_known_tempo(click_track):
    path, truth = click_track  # file + ground truth
    a = analyze_audio(path, fps=30)  # analyze at video fps
    assert a.tempo_bpm == pytest.approx(120, abs=2)  # pre-registered tolerance: +-2 BPM
    assert np.median(np.diff(a.beat_times)) == pytest.approx(0.5, abs=0.02)  # beat spacing
    nearest = [min(abs(b - t) for t in truth) for b in a.beat_times]  # error of each detected beat
    assert np.median(nearest) < 0.05  # detected beats sit on the clicks
    assert a.duration_s == pytest.approx(20.0, abs=0.01)  # duration from samples
    assert len(a.energy) == len(a.onset) == 600  # one value per video frame (20 s * 30 fps)
    assert 0.0 <= min(a.energy) and max(a.energy) == pytest.approx(1.0)  # normalized 0..1
    assert len(a.downbeats) == pytest.approx(len(a.beat_times) / 4, abs=1)  # every 4th beat


def test_snap_to_beat():
    beats = [1.0, 1.5, 2.0]  # beat grid
    assert snap_to_beat(1.6, beats, window=0.3) == 1.5  # within window -> nearest beat
    assert snap_to_beat(3.0, beats, window=0.3) == 3.0  # too far -> unchanged


def test_build_timeline_contract(click_track):
    path, _ = click_track  # 20 s audio
    sections = parse_lyrics("[Intro]\n(Ooh)\n\n[Verse 1]\nA matrix\n\n[Chorus]\nWe will know\n")
    aligned = [{"word": w, "startS": s, "endS": e, "success": True} for w, s, e in
               [("Ooh", 1.0, 2.0), ("A", 5.1, 5.4), ("matrix", 5.4, 6.0), ("We", 10.4, 10.8),
                ("will", 10.8, 11.1), ("know", 11.1, 12.0)]]  # fake Suno timings
    words, _ = align_words(sections, aligned)  # timed words
    tl = build_timeline(sections, words, analyze_audio(path, fps=30), fps=30, title="We Will Know",
                        scene_map={"intro": "intro", "verse 1": "layers", "chorus": "chorus"})
    assert tl["fps"] == 30 and tl["durationInFrames"] == 600  # 20 s at 30 fps
    assert tl["version"] == 2 and tl["vignettes"] == [] and tl["slots"] == {}  # no card catalog passed -> no cards
    assert [s["scene"] for s in tl["sections"]] == ["intro", "layers", "chorus"]  # scene per section
    starts = [s["startS"] for s in tl["sections"]]  # section boundaries
    assert starts[0] == 0.0 and starts == sorted(starts)  # intro at 0, monotonic
    assert starts[1] == pytest.approx(5.0, abs=0.03)  # 5.1 - lead, snapped onto the 5.0 s beat
    assert tl["sections"][-1]["endS"] == pytest.approx(20.0, abs=0.01)  # last section runs to the end
    assert all(a["endS"] == pytest.approx(b["startS"]) for a, b in zip(tl["sections"], tl["sections"][1:]))  # no gaps
    line = tl["lines"][2]  # "We will know"
    assert line["sectionIndex"] == 2 and [w["text"] for w in line["words"]] == ["We", "will", "know"]
    assert line["startS"] == pytest.approx(10.4) and line["endS"] == pytest.approx(12.0)  # line span from words


def test_shift_words_moves_every_word_and_clamps_at_zero():
    sections = parse_lyrics("[Verse 1]\nA matrix\n")
    aligned = [{"word": w, "startS": s, "endS": e, "success": True} for w, s, e in [("A", 0.05, 0.4), ("matrix", 0.4, 1.0)]]
    words, _ = align_words(sections, aligned)  # timed words
    shifted = shift_words(words, -0.137)  # exp05: Suno onsets are 0.137 s late on take 1
    assert [w.start for w in shifted] == pytest.approx([0.0, 0.263])  # 0.05 - 0.137 < 0 is clamped to the song start
    assert [w.end for w in shifted] == pytest.approx([0.263, 0.863])  # ends move by the same amount
    assert shift_words(words, 0.0) == words  # the default (0) leaves Suno's timings untouched
