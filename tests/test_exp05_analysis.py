"""Tests for the experiment helpers in scripts/analysis/ (used by exp03 and exp05).

Local: checks the pure parts of the onset-offset experiment on inputs with a known answer: the
line-cluster bootstrap, the cross-correlation lag finder, the windowed CTC emissions, the
symmetric anchor selection and the pre-registered decision rule.
Global context: exp05 decides whether the video's karaoke gets a global time offset; these
functions turn raw onsets into that decision, so each is pinned here before it is run on the song.
Sources: numpy random Generator https://numpy.org/doc/stable/reference/random/generator.html ,
         scipy.signal.correlation_lags https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.correlation_lags.html
"""

import numpy as np  # synthetic data
import pytest  # approx + raises

from analysis.anchors import ALL_LINE_STARTS, resolve_labels, select_anchors  # units under test
from analysis.decision import decide_offset  # unit under test
from analysis.stats import cluster_median_ci  # unit under test
from analysis.timebase import xcorr_lag  # unit under test


def test_cluster_bootstrap_covers_true_shift_and_is_reproducible():
    rng = np.random.default_rng(1)  # synthetic "lines": a shared per-line error plus word noise
    clusters = np.repeat(np.arange(50), 8)  # 50 lines x 8 words
    x = 0.2 + rng.normal(0, 0.05, 50)[clusters] + rng.normal(0, 0.05, len(clusters))  # true median 0.2
    med, lo, hi = cluster_median_ci(x, clusters, n_resamples=2000, seed=0)
    assert lo < 0.2 < hi and lo > 0  # covers the truth, excludes 0
    assert (med, lo, hi) == cluster_median_ci(x, clusters, n_resamples=2000, seed=0)  # same seed, same CI
    _, wlo, whi = cluster_median_ci(x, np.arange(len(x)), n_resamples=2000, seed=0)  # every word its own cluster
    assert whi - wlo < hi - lo  # ignoring the line correlation gives a too-narrow CI


def test_xcorr_lag_recovers_known_delay():
    rng = np.random.default_rng(0)
    ref = rng.standard_normal(5000)  # white noise has a sharp autocorrelation peak
    delayed = np.concatenate([np.zeros(37), ref])[:5000]  # same signal, 37 samples later
    assert xcorr_lag(ref, delayed, max_lag=200) == 37  # positive = second signal is late
    assert xcorr_lag(delayed, ref, max_lag=200) == -37  # antisymmetric
    assert xcorr_lag(ref, ref, max_lag=200) == 0


def test_windowed_emissions_match_unwindowed_for_a_local_model():
    torch = pytest.importorskip("torch")  # analysis group only
    from analysis.forced_alignment import windowed_emissions

    def fake_model(x):  # a local "model": one frame per 320 samples, receptive field 400, like wav2vec2
        frames = x.unfold(-1, 400, 320).mean(-1)  # (1, frames)
        return torch.stack([frames, -frames], -1), None  # (1, frames, 2 labels)

    wave = torch.randn(1, 16000 * 7 + 123)  # 7 s plus a ragged tail
    windowed = windowed_emissions(fake_model, wave, sr=16000, window_s=2, context_s=0.5)
    direct, _ = fake_model(wave)
    assert windowed.shape == direct.shape  # same number of frames as one pass over the whole song
    assert torch.allclose(windowed, direct, atol=1e-6)  # cropping the context keeps frames in place


def _rec(line, start, end, backing=False):
    return {"line": line, "backing": backing, "suno": start, "suno_end": end, "mms": start, "mms_end": end}


def test_select_anchors_requires_a_rest_in_both_timings():
    rec = [_rec(0, 0.0, 1.0), _rec(1, 2.0, 2.5), _rec(1, 2.6, 3.0), _rec(2, 3.2, 3.5), _rec(3, 5.0, 5.5, backing=True)]
    assert select_anchors(rec, gap_s=0.8) == [1]  # line 2 follows too closely; line 3 starts with a backing word
    rec[1]["mms"] = 1.5  # MMS sees only a 0.5 s rest before line 1
    assert select_anchors(rec, gap_s=0.8) == []  # selection needs the rest in both systems, so it favours neither
    many = [_rec(k, 2.0 * k, 2.0 * k + 0.5) for k in range(40)]  # 39 qualifying line starts
    picked = select_anchors(many, gap_s=0.8, max_n=20, seed=0)
    assert len(picked) == 20 and picked == sorted(picked) and picked == select_anchors(many, 0.8, 20, 0)  # seeded sample
    assert select_anchors(rec, **ALL_LINE_STARTS) == [1, 3]  # amendment 1: every lead line start, no timing used


def test_resolve_labels_maps_letters_manual_times_and_ambiguous():
    key = [{"panel": 1, "window_start_s": 10.0, "onsets_rel_s": [0.2, 0.9]},
           {"panel": 2, "window_start_s": 20.0, "onsets_rel_s": [0.5]}, {"panel": 3, "window_start_s": 30.0, "onsets_rel_s": []}]
    got = resolve_labels({"1": "B", "2": "manual:0.43", "3": "ambiguous"}, key)
    assert got == {1: pytest.approx(10.9), 2: pytest.approx(20.43), 3: None}  # window start + position in window


def test_decision_rule_cases():
    ok = dict(delta=0.2, delta_ci=(0.18, 0.22), beta=0.01, n_anchors=15, alpha_s=0.21, alpha_s_ci=(0.15, 0.26))
    assert decide_offset(**ok)["offset_s"] == pytest.approx(-0.2)  # all of D1-D4 hold
    assert decide_offset(**{**ok, "delta_ci": (-0.01, 0.4)})["offset_s"] == 0  # D1: CI includes 0
    assert decide_offset(**{**ok, "delta": 0.02, "delta_ci": (0.01, 0.03), "alpha_s": 0.02,
                            "alpha_s_ci": (0.01, 0.03)})["offset_s"] == 0  # D2: below one frame
    fb = decide_offset(**{**ok, "beta": 0.09})  # D3 fails: MMS itself is biased
    assert fb["offset_s"] == pytest.approx(-0.21) and fb["basis"] == "anchors"  # fallback to the anchors
    assert decide_offset(**{**ok, "alpha_s": -0.1, "alpha_s_ci": (-0.2, -0.05)})["offset_s"] == 0  # D4: wrong sign
    assert decide_offset(**{**ok, "n_anchors": 5, "alpha_s_ci": (-0.1, 0.3)})["offset_s"] == 0  # D3 and D4 fail
