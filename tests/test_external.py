"""Tests for scripts/analysis/external.py (reusing released third-party artifacts).

Local: known-answer checks on synthetic inputs: log-spaced downsampling keeps the curve's ends, the Fourier
norms of a modular embedding find planted frequencies, the numpy-only unpickler loads arrays but refuses any
other global, a plotly heatmap grid is read from HTML, and an attribution graph collapses into its supernodes.
Global context: these transforms turn downloads into the figure-card data in video/public/vignettes/, so a bug
here would put wrong numbers on screen; reports/exp07 relies on them. No network, no torch.
"""

import os  # the forbidden global in the malicious pickle
import pickle  # build test pickles

import numpy as np  # synthetic arrays
import pytest  # raises

from analysis.external import fourier_norms, load_numpy_pickle, log_downsample, plotly_z, supernode_graph  # units under test


def test_log_downsample_keeps_ends_and_is_sorted():
    pts = log_downsample(list(range(1000)), n=50, every=10)  # value i logged at step 10*i
    steps = [s for s, _ in pts]
    assert pts[0] == [0, 0.0] and pts[-1] == [9990, 999.0]  # first and last samples kept
    assert steps == sorted(set(steps)) and len(pts) <= 50  # strictly increasing, at most n points


def test_fourier_norms_find_planted_frequencies():
    p, x = 113, np.arange(113)  # Z_113 tokens
    rng = np.random.default_rng(0)
    E = np.outer(np.cos(2 * np.pi * 14 * x / p), rng.normal(size=8)) + np.outer(np.sin(2 * np.pi * 41 * x / p), rng.normal(size=8))
    norms = fourier_norms(E.T, p)  # W_E is stored d_model x vocab, like Nanda et al.'s embed.W_E
    assert set(int(k) for k in np.argsort(norms)[-2:] + 1) == {14, 41}  # the two planted frequencies
    assert norms.shape == (56,)  # k = 1 .. (p - 1) / 2


class _Evil:
    def __reduce__(self):
        return os.system, ("echo pwned",)  # would run a shell command if unpickled normally


def test_numpy_only_unpickler(tmp_path):
    ok = tmp_path / "ok.pkl"
    ok.write_bytes(pickle.dumps([{"Test Error": np.arange(6.0).reshape(2, 3)}], protocol=3))
    assert load_numpy_pickle(ok)[0]["Test Error"][1, 2] == 5.0  # numpy arrays load
    bad = tmp_path / "bad.pkl"
    bad.write_bytes(pickle.dumps(_Evil(), protocol=3))
    with pytest.raises(pickle.UnpicklingError, match="not allowed"):  # refused before anything executes
        load_numpy_pickle(bad)


def test_plotly_z_reads_the_heatmap_grid():
    html = '<script>Plotly.newPlot("x", [{"type":"heatmap","z":[[0.1,0.2],[0.3,0.909]],"x":[0,1]}])</script>'
    assert plotly_z(html) == [[0.1, 0.2], [0.3, 0.909]]


def test_supernode_graph_aggregates_member_links():
    node = lambda js, nid, layer, ctx, kind="cross layer transcoder", clerp="": {  # noqa: E731
        "jsNodeId": js, "node_id": nid, "layer": str(layer), "ctx_idx": ctx, "feature_type": kind, "clerp": clerp}
    graph = {
        "metadata": {"prompt": "Dallas is", "prompt_tokens": ["Dallas", " is"]},
        "qParams": {"pinnedIds": ["a1", "a2", "b1", "out"], "supernodes": [["Dallas", "a1", "a2"], ["say Austin", "b1"]]},
        "nodes": [node("a1", "1_1_0", 1, 0), node("a2", "2_2_0", 3, 0), node("b1", "9_9_1", 9, 1),
                  node("out", "18_5_1", 18, 1, "logit", 'output: "Austin" (p=0.98)'), node("x", "4_4_0", 4, 0)],
        "links": [{"source": "1_1_0", "target": "9_9_1", "weight": 0.5}, {"source": "2_2_0", "target": "9_9_1", "weight": 0.25},
                  {"source": "9_9_1", "target": "18_5_1", "weight": 0.75}, {"source": "4_4_0", "target": "9_9_1", "weight": 9.0}],
    }
    g = supernode_graph(graph)
    labels = {n["label"]: n for n in g["nodes"]}
    assert set(labels) == {"Dallas", "say Austin", 'output: "Austin" (p=0.98)'}  # unpinned node "x" is dropped
    assert labels["Dallas"]["layer"] == pytest.approx(2.0) and labels["Dallas"]["token"] == "Dallas"  # mean layer, its token
    edges = {(e["source"], e["target"]): e["weight"] for e in g["edges"]}
    assert edges[("Dallas", "say Austin")] == pytest.approx(0.75)  # member links summed
    assert ("say Austin", 'output: "Austin" (p=0.98)') in edges and len(edges) == 2
