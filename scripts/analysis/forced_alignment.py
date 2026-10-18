"""Lyrics-aware word onsets: torchaudio MMS_FA CTC forced alignment on a vocal stem.

Local: windowed_emissions runs the acoustic model over 30 s windows with 2 s of context on each side
and crops the context, so a 4-minute song never needs full self-attention over 12 000 frames;
mms_word_spans force-aligns the known lyric words to those emissions once, over the whole song.
Global context: exp05's primary reference. Unlike Whisper it is given the lyrics (every word gets a
time, no recognition errors) and hears the voice without the orchestra.
Sources: torchaudio MMS_FA bundle, tokenizer and aligner
  https://docs.pytorch.org/audio/2.8/tutorials/forced_alignment_for_multilingual_data_tutorial.html ;
  forced_align / merge_tokens / TokenSpan https://docs.pytorch.org/audio/main/tutorials/ctc_forced_alignment_api_tutorial.html ;
  windowing scheme of ctc-forced-aligner's generate_emissions (30 s window, 2 s context)
  https://github.com/MahmoudAshraf97/ctc-forced-aligner/blob/main/ctc_forced_aligner/alignment_utils.py ;
  Pratap et al. (2023), Scaling Speech Technology to 1,000+ Languages, arXiv:2305.13516
"""

import logging  # progress
import math  # ceil
import time  # timing
from pathlib import Path  # paths

log = logging.getLogger(__name__)  # module logger

WINDOW_S = 30  # emission window (pre-registered)
CONTEXT_S = 2  # context on each side, cropped after inference (pre-registered)
FRAME_SAMPLES = 320  # wav2vec2 conv stride: one emission frame per 20 ms at 16 kHz
RECEPTIVE_SAMPLES = 400  # first conv kernel: frames = (n - 400) // 320 + 1


def windowed_emissions(model, wave, sr: int, window_s: float = WINDOW_S, context_s: float = CONTEXT_S):
    """Local: (1, frames, labels) emissions of `model` over `wave` (1, n), computed window by window.
    Global: same frame grid as a single pass over the whole song (frame f starts at sample 320 f)."""
    import torch  # tensors
    window, context = int(window_s * sr), int(context_s * sr)  # samples
    assert window % FRAME_SAMPLES == 0 and context % FRAME_SAMPLES == 0  # keeps chunks on the frame grid
    n = wave.shape[1]  # song length in samples
    ext = (-n) % window  # pad the tail to a whole number of windows
    padded = torch.nn.functional.pad(wave, (context, context + ext))  # context on both sides
    c0, w = context // FRAME_SAMPLES, window // FRAME_SAMPLES  # frames to skip / keep per chunk
    out = []  # cropped chunk emissions
    for start in range(0, n + ext, window):  # one chunk per window
        em, _ = model(padded[:, start:start + window + 2 * context])  # (1, frames, labels)
        out.append(em[:, c0:c0 + w])  # drop the context frames
    total = (n - RECEPTIVE_SAMPLES) // FRAME_SAMPLES + 1  # frames of an unwindowed pass
    return torch.cat(out, dim=1)[:, :total]  # trim the padded tail


def mms_word_spans(vocals: Path, words: list[str]) -> list[dict]:
    """Local: one {start, end, score} per written word (seconds; score = mean token probability).
    Global: phase 2 of exp05; `words` are the normalised written words in sung order."""
    import librosa  # decoding + resampling
    import torch  # inference
    import torchaudio  # MMS_FA bundle
    bundle = torchaudio.pipelines.MMS_FA  # wav2vec2 forced-alignment model, 16 kHz, log-softmax outputs
    model = bundle.get_model(with_star=False).eval()  # no <star> token: every frame is a letter or blank
    tokenizer, aligner = bundle.get_tokenizer(), bundle.get_aligner()  # chars -> ids; CTC forced alignment
    wave, _ = librosa.load(vocals, sr=bundle.sample_rate, mono=True)  # stem -> 16 kHz mono
    t0 = time.perf_counter()
    with torch.inference_mode():
        emission = windowed_emissions(model, torch.from_numpy(wave)[None], bundle.sample_rate)  # (1, T, labels)
    spans = aligner(emission[0], tokenizer(words))  # list (per word) of TokenSpan lists
    sec = FRAME_SAMPLES / bundle.sample_rate  # seconds per frame, as span.start * ratio in the tutorial
    log.info("MMS_FA: %d frames, %d words aligned in %.1f s", emission.shape[1], len(spans), time.perf_counter() - t0)
    return [{"start": round(s[0].start * sec, 4), "end": round(s[-1].end * sec, 4),
             "score": round(sum(t.score * len(t) for t in s) / sum(len(t) for t in s), 4)} for s in spans]
