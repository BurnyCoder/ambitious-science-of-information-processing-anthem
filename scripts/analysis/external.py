"""Helpers for reusing released third-party artifacts instead of re-running their experiments.

Local: download-once caching with provenance records (URL, revision, licence, size, sha256), a numpy-only
unpickler for untrusted pickles, and small pure transforms: log-spaced downsampling of loss curves, Fourier
norms of a modular-arithmetic embedding, the heatmap grid inside a plotly HTML export, and the supernode graph
of an attribution-graph JSON.
Global context: scripts/vignette_data.py calls these to turn the downloads in data/external/ into the compact
JSON the figure cards draw (video/public/vignettes/); reports/exp07 cites the provenance records.
Sources:
- pickle "Restricting Globals": https://docs.python.org/3/library/pickle.html#restricting-globals
- Fourier basis of Z_p used for key frequencies, as in Nanda et al. 2023's code:
  https://github.com/mechanistic-interpretability-grokking/progress-measures-paper/blob/main/Grokking_Analysis.ipynb
- attribution-graph JSON format (nodes / links / qParams.supernodes) as served by
  https://transformer-circuits.pub/2025/attribution-graphs/biology.html
- httpx streaming download: https://www.python-httpx.org/quickstart/#streaming-responses
"""

import datetime as dt  # access dates in provenance records
import hashlib  # sha256 of every download
import importlib  # resolve the few allowed pickle globals
import json  # plotly grid
import pickle  # restricted unpickler
import re  # find the plotly "z" array
from pathlib import Path  # paths

import httpx  # downloads (already a pipeline dependency)
import numpy as np  # transforms

ALLOWED_GLOBALS = {  # everything a pickle of plain numpy arrays needs, nothing that can run code
    ("numpy", "ndarray"), ("numpy", "dtype"),
    ("numpy.core.multiarray", "_reconstruct"), ("numpy.core.multiarray", "scalar"),
    ("numpy._core.multiarray", "_reconstruct"), ("numpy._core.multiarray", "scalar"),
}


def fetch(url: str, dest: Path) -> Path:
    """Local: download url to dest once (atomic rename), reuse it afterwards.  Global: no repeated downloads."""
    if dest.exists() and dest.stat().st_size > 0:  # cached
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")  # never leave a half file under the real name
    with httpx.stream("GET", url, follow_redirects=True, timeout=300) as r:
        r.raise_for_status()  # 404 etc. stop the run
        with tmp.open("wb") as f:
            for chunk in r.iter_bytes():
                f.write(chunk)
    tmp.replace(dest)
    return dest


def record(path: Path, url: str, licence: str, revision: str = "", root: Path | None = None) -> dict:
    """Local: provenance of one file; "accessed" is the cached file's modification date (its download).
    Global: rows of reports/data/exp07_sources.json."""
    digest = hashlib.sha256(path.read_bytes()).hexdigest()  # identifies the exact bytes used
    downloaded = dt.date.fromtimestamp(path.stat().st_mtime).isoformat()  # when the cached copy was fetched, not when this ran
    name = str(path.relative_to(root)) if root else str(path)
    return {"file": name.replace("\\", "/"), "url": url, "revision": revision, "licence": licence,
            "bytes": path.stat().st_size, "sha256": digest, "accessed": downloaded}


class _NumpyOnlyUnpickler(pickle.Unpickler):
    """Local: refuses every global except numpy array reconstruction.  Global: safe loading of downloaded pickles."""

    def find_class(self, module: str, name: str):
        if (module, name) not in ALLOWED_GLOBALS:  # e.g. os.system, builtins.eval
            raise pickle.UnpicklingError(f"global {module}.{name} is not allowed")
        return getattr(importlib.import_module(module.replace("numpy.core.", "numpy._core.")), name)  # numpy 2 path


def load_numpy_pickle(path: Path):
    """Local: unpickle a file that may only contain builtins and numpy arrays.  Global: double-descent data."""
    with path.open("rb") as f:
        return _NumpyOnlyUnpickler(f).load()


def log_downsample(values, n: int = 160, every: int = 1) -> list[list[float]]:
    """Local: [step, value] at about n log-spaced indices (first and last kept); value i was logged at step
    i * every.  Global: loss curves small enough to embed, still faithful on a log-step axis."""
    idx = np.unique(np.round(np.geomspace(1, len(values), n)).astype(int)) - 1  # 0 .. len-1, log spaced
    return [[int(i * every), float(values[i])] for i in idx]


def fourier_norms(W_E: np.ndarray, p: int) -> np.ndarray:
    """Local: norm of the embedding along the cos and sin of each frequency k = 1 .. (p-1)/2, for the first p
    tokens (W_E is d_model x vocab, as stored by Nanda et al.).  Global: key frequencies of the grokked model."""
    E = np.asarray(W_E, dtype=np.float64)[:, :p].T  # p tokens x d_model (drops the "=" token)
    x = np.arange(p)  # token values 0 .. p-1
    out = []
    for k in range(1, (p - 1) // 2 + 1):
        c, s = np.cos(2 * np.pi * k * x / p), np.sin(2 * np.pi * k * x / p)  # Fourier basis vectors
        c, s = c / np.linalg.norm(c), s / np.linalg.norm(s)  # orthonormal
        out.append(np.hypot(np.linalg.norm(c @ E), np.linalg.norm(s @ E)))  # energy at frequency k
    return np.array(out)


def plotly_z(html: str) -> list[list[float]]:
    """Local: the first heatmap "z" grid in a plotly HTML export.  Global: ARENA's per-head induction scores."""
    m = re.search(r'"z":\s*(\[\[.*?\]\])', html, re.S)  # nested list right after "z":
    if not m:
        raise ValueError("no plotly heatmap grid found")
    return json.loads(m.group(1))


def supernode_graph(graph: dict, max_nodes: int = 12) -> dict:
    """Local: collapse an attribution graph into its curated supernodes (plus pinned output logits), sum the
    link weights between members, keep the max_nodes most connected groups and their positive edges.
    Global: the paper-level graph drawn on the Dallas / rabbit / 36+59 cards."""
    q = graph["qParams"]  # the authors' curated view
    by_js = {n["jsNodeId"]: n for n in graph["nodes"]}  # viewer ids
    js_of = {n["node_id"]: n["jsNodeId"] for n in graph["nodes"]}  # links use node_id
    group = {m: name for name, *members in q["supernodes"] for m in members}  # member -> supernode label
    for js in q["pinnedIds"]:  # pinned output logits are their own nodes
        if js in by_js and by_js[js]["feature_type"] == "logit":
            group[js] = by_js[js]["clerp"]
    weight: dict[tuple[str, str], float] = {}  # (label, label) -> summed weight
    for link in graph["links"]:
        a, b = group.get(js_of.get(link["source"])), group.get(js_of.get(link["target"]))
        if a and b and a != b:  # between two different groups
            weight[(a, b)] = weight.get((a, b), 0.0) + link["weight"]
    strength: dict[str, float] = {}  # how connected each group is
    for (a, b), w in weight.items():
        strength[a] = strength.get(a, 0.0) + abs(w)
        strength[b] = strength.get(b, 0.0) + abs(w)
    keep = set(sorted(strength, key=strength.get, reverse=True)[:max_nodes])  # most connected groups
    tokens = graph["metadata"]["prompt_tokens"]  # token strings by position
    nodes = []
    for label in sorted(keep):
        members = [by_js[js] for js, g in group.items() if g == label and js in by_js]
        ctx = round(float(np.mean([m["ctx_idx"] for m in members])))  # typical position
        nodes.append({"label": label, "layer": float(np.mean([int(m["layer"]) for m in members])),
                      "ctx": ctx, "token": tokens[ctx] if 0 <= ctx < len(tokens) else "",
                      "output": any(m["feature_type"] == "logit" for m in members)})
    edges = [{"source": a, "target": b, "weight": round(w, 4)} for (a, b), w in weight.items()
             if a in keep and b in keep and w > 0]  # excitatory edges only, as in the paper's diagrams
    return {"prompt": graph["metadata"]["prompt"], "tokens": tokens, "nodes": nodes,
            "edges": sorted(edges, key=lambda e: -e["weight"])}
