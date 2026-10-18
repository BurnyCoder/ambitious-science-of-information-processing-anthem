"""Whisper word onsets: the lyrics-blind timing reference of exp03, reused in exp05.

Local: whisper_words transcribes a file with faster-whisper (word timestamps); match_pairs pairs
written words with recognised words by normalised text (difflib, exact blocks only).
Global context: exp03 found Suno onsets ~0.23 s later than these; exp05 asks which side is biased,
so it re-runs exactly this reference next to a lyrics-aware forced aligner.
Sources: faster-whisper word_timestamps https://github.com/SYSTRAN/faster-whisper#word-level-timestamps ;
         difflib opcodes https://docs.python.org/3/library/difflib.html#difflib.SequenceMatcher.get_opcodes
"""

from difflib import SequenceMatcher  # text matching
from pathlib import Path  # paths

from anthem.lyrics import normalize_word  # same matching key as the pipeline


def whisper_words(audio: Path, model_size: str = "small.en") -> list[dict]:
    """Local: recognised words with start/end/probability.  Global: the independent reference of exp03."""
    from faster_whisper import WhisperModel  # heavy import only when used
    import librosa  # decode ourselves: faster-whisper's PyAV decoder passes a kwarg the installed PyAV rejects
    model = WhisperModel(model_size, device="cpu", compute_type="int8")  # CPU int8 inference
    wave, _ = librosa.load(audio, sr=16000, mono=True)  # Whisper expects 16 kHz mono float32
    segments, _ = model.transcribe(wave, language="en", word_timestamps=True, beam_size=5)  # ndarray input is supported
    return [{"norm": normalize_word(w.word), "start": w.start, "end": w.end, "p": w.probability}
            for seg in segments for w in (seg.words or []) if normalize_word(w.word)]  # flatten, drop punctuation


def match_pairs(written_norms: list[str], ref_norms: list[str]) -> list[tuple[int, int]]:
    """Local: (written index, reference index) for words inside exact-match blocks.
    Global: only these pairs are scored, so recognition errors never become timing errors."""
    sm = SequenceMatcher(None, written_norms, ref_norms, autojunk=False)  # no junk heuristic
    return [(i1 + k, j1 + k) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag == "equal" for k in range(i2 - i1)]
