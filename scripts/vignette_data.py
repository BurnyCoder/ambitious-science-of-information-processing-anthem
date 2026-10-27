"""Experiment 07, data phase: released third-party artifacts -> figure-card data, with provenance.

Local: downloads each pinned source once into data/external/ (gitignored), derives compact JSON (plus two
images) for the figure cards into video/public/vignettes/, and writes reports/data/exp07_sources.json (URL,
revision, licence, bytes, sha256, access date per file) and reports/data/exp07_checks.json (the checks
pre-specified in reports/exp07_provenance.md, run on the released data).
Global context: no experiment is re-run here. Every number on a "released data" card is read or derived
(downsampling, Fourier norms, supernode sums) from these files; the TS cards import the JSON statically.
Sources: see SOURCES below and reports/exp07_provenance.md; helpers in scripts/analysis/external.py.
Usage: uv run --group analysis python -I scripts/vignette_data.py
"""

import csv  # Epoch / world-models / WeightWatcher tables
import json  # inputs + outputs
import logging  # timestamped logs
import shutil  # copy images
import sys  # import paths (-I drops the script directory)
from pathlib import Path  # paths

import numpy as np  # transforms

ROOT = Path(__file__).resolve().parents[1]  # repo root
sys.path[:0] = [str(ROOT / "src"), str(ROOT / "scripts")]  # pipeline package + experiment helpers
from anthem.logging_setup import log_json, setup_logging  # terminal + file logs, full payloads
from analysis.external import fetch, fourier_norms, load_numpy_pickle, log_downsample, plotly_z, record, supernode_graph

EXT = ROOT / "data" / "external"  # downloads (gitignored)
OUT = ROOT / "video" / "public" / "vignettes"  # card data (committed, small)
DATA = ROOT / "reports" / "data"  # provenance + checks (committed)
log = logging.getLogger("exp07")  # stable logger name

GH = "https://raw.githubusercontent.com"  # pinned-commit raw files
CIRCUITS = "https://transformer-circuits.pub/2025/attribution-graphs/graph_data"  # Lindsey et al. 2025 graphs
GPT2_REV = "607a30d783dfa663caf39e06633721c8d4cfcd7e"  # openai-community/gpt2 commit used for the tokenizer
GROK_REV = "80e5dbb5744dd3e958e45e56f7562a4d50c7400c"  # callummcdougall/grokking_full_run_data commit
DAY_FEATURES = [2592, 4445, 4663, 4733, 6531, 8179, 9566, 20927, 24185]  # GPT-2 L7 day latents (Engels et al. README)
SOURCES = [  # (local file, url, licence, revision); HF files are fetched by huggingface_hub with a pinned revision
    ("circuits/capital-state-dallas.json", f"{CIRCUITS}/capital-state-dallas.json", "none stated", "accessed copy"),
    ("circuits/rabbit-poem.json", f"{CIRCUITS}/rabbit-poem.json", "none stated", "accessed copy"),
    ("circuits/calc-36-plus-59.json", f"{CIRCUITS}/calc-36-plus-59.json", "none stated", "accessed copy"),
    ("neuronpedia/gemma-fact-dallas-austin.json",
     "https://neuronpedia-attrib.s3.us-east-1.amazonaws.com/user-graphs/cmao6p1xd0000ypedw0qhlhob/gemma-fact-dallas-austin.json",
     "none stated (Neuronpedia; Gemma Scope weights CC-BY-4.0)", "accessed copy"),
    *[(f"neuronpedia/gpt2-small_7-res-jb_{i}.json", f"https://www.neuronpedia.org/api/feature/gpt2-small/7-res-jb/{i}",
       "none stated (Neuronpedia; SAE weights MIT)", "accessed copy") for i in DAY_FEATURES],
    ("arena/1206-A.html", "https://info-arena.github.io/ARENA_img/misc/media-12/1206-A.html", "none stated", "7eb0b60b77110e46b00c914d730fe8a9f517922e"),
    ("epoch/notable_ai_models.csv", "https://epoch.ai/data/notable_ai_models.csv", "CC BY 4.0", "accessed copy"),
    ("epoch/svg_extracted_data.csv", f"{GH}/epoch-research/analyzing-chinchilla/92258837425e1b5f2851d624287f0120583a3d0e/data/svg_extracted_data.csv",
     "none stated", "92258837425e1b5f2851d624287f0120583a3d0e"),
    ("dd/Mlist", "https://storage.googleapis.com/hml-public/dd/cifar10-resnet18k-p15-adam-reps/Mlist", "none stated", "accessed copy"),
    ("dd/ks", "https://storage.googleapis.com/hml-public/dd/cifar10-resnet18k-p15-adam-reps/ks", "none stated", "accessed copy"),
    ("worldmodels/world_place.csv", f"{GH}/wesg52/world-models/a572f162948ee185e9c842eb5fa15e23aad3d218/data/entity_datasets/world_place.csv",
     "MIT", "a572f162948ee185e9c842eb5fa15e23aad3d218"),
    ("fv/antonym.json", f"{GH}/ericwtodd/function_vectors/fb9eac7b6dc707ea1475a717379916007fe448d5/dataset_files/abstractive/antonym.json",
     "MIT", "fb9eac7b6dc707ea1475a717379916007fe448d5"),
    *[(f"refusal/{name}", f"{GH}/andyrdt/refusal_direction/9d852fae1a9121c78b29142de733cb1340770cc3/pipeline/runs/meta-llama-3-8b-instruct/{path}",
       "Apache-2.0", "9d852fae1a9121c78b29142de733cb1340770cc3")
      for name, path in [("direction_evaluations.json", "select_direction/direction_evaluations.json"),
                         ("direction_metadata.json", "direction_metadata.json"),
                         ("jailbreakbench_baseline_evaluations.json", "completions/jailbreakbench_baseline_evaluations.json"),
                         ("jailbreakbench_ablation_evaluations.json", "completions/jailbreakbench_ablation_evaluations.json"),
                         ("harmless_actadd_evaluations.json", "completions/harmless_actadd_evaluations.json")]],
    ("ww/gpt2_small.csv", f"{GH}/CalculatedContent/ww-trends-2020/efe472321357d1257d3bc731e94646923d733480/data/gpt2%20small.csv",
     "none stated", "efe472321357d1257d3bc731e94646923d733480"),
    *[(f"pmp/{f}", f"{GH}/mechanistic-interpretability-grokking/progress-measures-paper/23d2c64dd1f8a5ca65efaf27e15c2b2cd47dedf1/saved_runs/{f}",
       "none stated", "23d2c64dd1f8a5ca65efaf27e15c2b2cd47dedf1") for f in ["wd_10-1_mod_addition_loss_curve.pth"]],
    ("tms/toy_models.ipynb", f"{GH}/anthropics/toy-models-of-superposition/562710e079704b84a132b640db134d4cebe22466/toy_models.ipynb",
     "MIT", "562710e079704b84a132b640db134d4cebe22466"),
    ("goodfire/figure_1.png", f"{GH}/goodfire-ai/block-sparse-featurizer/219f121ea82d2b19200d1dac918396e6058d7eb9/assets/figure_1.png",
     "MIT", "219f121ea82d2b19200d1dac918396e6058d7eb9"),
]
PAPER_KEY_FREQS = [14, 35, 41, 42, 52]  # Nanda et al. 2023 §4.1 (mainline run)
EPOCH_CITED = {"AlexNet": 6.0e7, "GPT-2 (1.5B)": 1.5e9, "GPT-3 175B (davinci)": 1.746e11, "PaLM (540B)": 5.4035e11, "Switch": 1.571e12}
SCALE_MODELS = ["Perceptron Mark I", "LeNet-5", "AlexNet", "Transformer", "GPT-2 (1.5B)", "GPT-3 175B (davinci)", "Switch", "PaLM (540B)"]
CHINCHILLA = {"hoffmann": {"E": 1.6934, "A": 406.4, "B": 410.7, "alpha": 0.3392, "beta": 0.2849},  # arXiv:2203.15556 (TeX values)
              "epoch": {"E": 1.8172, "A": 482.01, "B": 2085.43, "alpha": 0.3478, "beta": 0.3658}}  # arXiv:2404.10102 Table 1


def write(name: str, obj) -> None:
    """Local: compact JSON into video/public/vignettes/.  Global: imported by the TS cards."""
    path = OUT / f"{name}.json"
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log.info("Wrote %s (%.1f KB)", path.relative_to(ROOT), path.stat().st_size / 1024)


def download_all() -> list[dict]:
    """Local: fetch every source once and return its provenance rows.  Global: exp07_sources.json."""
    from huggingface_hub import hf_hub_download  # pinned HF files
    rows = []
    for rel, url, licence, rev in SOURCES:
        rows.append(record(fetch(url, EXT / rel), url, licence, rev, EXT))
    grok = Path(hf_hub_download("callummcdougall/grokking_full_run_data", "full_run_data.pth", revision=GROK_REV,
                                local_dir=EXT / "grokking_full_run_data"))  # 456 MB, Nanda et al. mainline run
    rows.append(record(grok, "https://huggingface.co/callummcdougall/grokking_full_run_data", "none stated", GROK_REV, EXT))
    tok = Path(hf_hub_download("openai-community/gpt2", "tokenizer.json", revision=GPT2_REV, local_dir=EXT / "gpt2"))
    rows.append(record(tok, "https://huggingface.co/openai-community/gpt2", "MIT", GPT2_REV, EXT))
    for r in rows:
        log.info("Source %s: %d bytes, sha256 %s…", r["file"], r["bytes"], r["sha256"][:12])
    return rows


def grokking(checks: dict) -> None:
    """Local: loss curves, Fourier spectra over training, and the weight-decay comparison.
    Global: grokking / grokClock / weightDecay cards; check 1 (key frequencies)."""
    import torch  # released .pth files
    run = torch.load(EXT / "grokking_full_run_data" / "full_run_data.pth", weights_only=True, map_location="cpu")
    p = run["config"]["p"]  # 113
    spectra = [fourier_norms(sd["embed.W_E"].numpy(), p) for sd in run["state_dicts"][::10]]  # every 1000 epochs
    norms40k = fourier_norms(run["state_dicts"][400]["embed.W_E"].numpy(), p)  # the model analysed in the paper
    top5 = sorted(int(k) for k in np.argsort(norms40k)[-5:] + 1)  # five largest frequencies
    top6 = sorted(int(k) for k in np.argsort(norms40k)[-6:] + 1)
    checks["grokking_key_frequencies"] = {"pre_specified": "top-5 Fourier frequencies of W_E at epoch 40k == paper's key frequencies",
                                          "paper": PAPER_KEY_FREQS, "top5": top5, "top6": top6, "pass": top5 == PAPER_KEY_FREQS}
    wd01 = torch.load(EXT / "pmp" / "wd_10-1_mod_addition_loss_curve.pth", weights_only=True, map_location="cpu")
    wd = wd01["optimizer"]["param_groups"][0]["weight_decay"]  # 0.1 (the stored config dict says 1, the optimizer says 0.1)
    first_below = lambda curve, every: int(np.argmax(np.asarray(curve) < 1.0)) * every  # noqa: E731  first epoch with test loss < 1
    write("grokking", {
        "config": run["config"], "phases": [1400, 9400, 14000],  # Nanda et al. §5.2: memorization / circuit formation / cleanup
        "train": log_downsample(run["train_losses"], 180, 1), "test": log_downsample(run["test_losses"], 180, 10),
        "spectraEpochs": [int(e) for e in run["epochs"][::10]], "spectra": [[round(float(v), 3) for v in s] for s in spectra],
        "keyFreqs": PAPER_KEY_FREQS, "top5At40k": top5,
        "wd": [{"weightDecay": 1.0, "seed": 0, "test": log_downsample(run["test_losses"], 160, 10), "testBelow1At": first_below(run["test_losses"], 10)},
               {"weightDecay": wd, "seed": wd01["config"]["seed"], "test": log_downsample(wd01["test_losses"], 160, 10),
                "testBelow1At": first_below(wd01["test_losses"], 10)}],
    })


def induction(checks: dict) -> None:
    """Local: ARENA's 12x12 induction-score grid.  Global: induction card; check 2."""
    z = plotly_z((EXT / "arena" / "1206-A.html").read_text(encoding="utf-8"))  # z[layer][head]
    flat = sorted(((v, f"{l}.{h}") for l, row in enumerate(z) for h, v in enumerate(row)), reverse=True)
    top5 = [{"head": name, "score": round(v, 3)} for v, name in flat[:5]]
    checks["induction_heads"] = {"pre_specified": "ARENA's top-5 induction heads include IOI's induction heads 5.5 and 6.9",
                                 "top5": top5, "pass": {"5.5", "6.9"} <= {t["head"] for t in top5}}
    write("induction", {"z": [[round(v, 3) for v in row] for row in z], "top": top5})


def graphs() -> None:
    """Local: supernode graphs of three Anthropic attribution graphs + Gemma's top outputs.  Global: graph cards."""
    out = {name: supernode_graph(json.loads((EXT / "circuits" / f"{slug}.json").read_text(encoding="utf-8")), max_nodes)
           for name, slug, max_nodes in [("dallas", "capital-state-dallas", 8), ("rabbit", "rabbit-poem", 10), ("calc", "calc-36-plus-59", 10)]}
    gemma = json.loads((EXT / "neuronpedia" / "gemma-fact-dallas-austin.json").read_text(encoding="utf-8"))
    logits = sorted((n for n in gemma["nodes"] if n.get("feature_type") == "logit"), key=lambda n: -n["token_prob"])
    out["gemma"] = {"prompt": gemma["metadata"]["prompt"], "nodes": len(gemma["nodes"]), "links": len(gemma["links"]),
                    "outputs": [{"token": n["clerp"].split('"')[1], "p": round(n["token_prob"], 3)} for n in logits[:8]]}
    write("graphs", out)


def features() -> None:
    """Local: labels, decoder cosines and top contexts of GPT-2 small layer-7 day latents (Neuronpedia).
    Global: neuronFeature and dayCircle cards."""
    days = []
    for i in DAY_FEATURES:
        d = json.loads((EXT / "neuronpedia" / f"gpt2-small_7-res-jb_{i}.json").read_text(encoding="utf-8"))
        cos = {int(j): round(v, 3) for j, v in zip(d["topkCosSimIndices"], d["topkCosSimValues"]) if j in DAY_FEATURES and j != i}
        contexts = []
        for a in d["activations"][:4]:  # strongest examples first
            k = a["maxValueTokenIndex"]  # peak token
            lo = max(0, k - 7)
            contexts.append({"tokens": a["tokens"][lo:k + 3], "values": [round(v, 2) for v in a["values"][lo:k + 3]], "peak": k - lo})
        days.append({"index": i, "label": d["explanations"][0]["description"], "cos": cos,
                     "pos": d["pos_str"][:5], "contexts": contexts if i == 4733 else []})
    write("days", days)


def scale(checks: dict) -> None:
    """Local: params vs date for every Epoch notable model, plus labelled milestones.  Global: scale card."""
    rows = list(csv.DictReader((EXT / "epoch" / "notable_ai_models.csv").open(encoding="utf-8")))
    year = lambda d: int(d[:4]) + (int(d[5:7]) - 1) / 12  # noqa: E731  "2020-05-28" -> 2020.33
    pts = [[round(year(r["Publication date"]), 2), round(float(np.log10(float(r["Parameters"]))), 3)]
           for r in rows if r["Parameters"] and r["Publication date"] and float(r["Parameters"]) > 0]
    named = {r["Model"]: r for r in rows if r["Model"] in SCALE_MODELS}
    marks = [{"name": m, "year": round(year(named[m]["Publication date"]), 2), "params": float(named[m]["Parameters"])} for m in SCALE_MODELS]
    checks["epoch_parameters"] = {"pre_specified": "parameter counts shown match the Epoch CSV",
                                  "values": {m: float(named[m]["Parameters"]) for m in EPOCH_CITED},
                                  "pass": all(float(named[m]["Parameters"]) == v for m, v in EPOCH_CITED.items())}
    write("scale", {"points": pts, "marks": marks, "accessed": record(EXT / "epoch" / "notable_ai_models.csv", "", "")["accessed"]})


def chinchilla() -> None:
    """Local: Epoch's 245 points extracted from Hoffmann et al. Fig. 4 + both parametric fits.  Global: theory plot."""
    rows = list(csv.DictReader((EXT / "epoch" / "svg_extracted_data.csv").open(encoding="utf-8")))
    pts = [[float(r["Model Size"]), float(r["Training FLOP"]), float(r["loss"])] for r in rows]
    write("chinchilla", {"points": [[round(n, 0), round(c, -10), round(l, 4)] for n, c, l in pts], "fits": CHINCHILLA})


def double_descent() -> None:
    """Local: final-epoch train/test error vs ResNet18 width, 5 trials (Nakkiran et al. Fig. 1 data).
    Global: doubleDescent card. Errors are as stored (test error on the clean test labels)."""
    ms, ks = load_numpy_pickle(EXT / "dd" / "Mlist"), load_numpy_pickle(EXT / "dd" / "ks")  # numpy-only unpickler
    test = np.stack([m["Test Error"][:, -1] for m in ms])  # trials x widths, last epoch
    train = np.stack([m["Train Error"][:, -1] for m in ms])
    write("double_descent", {"k": [int(k) for k in ks], "testMean": np.round(test.mean(0), 4).tolist(),
                             "testMin": np.round(test.min(0), 4).tolist(), "testMax": np.round(test.max(0), 4).tolist(),
                             "trainMean": np.round(train.mean(0), 4).tolist(), "trials": len(ms)})


def world() -> None:
    """Local: the 900 most-viewed places' lat/lon (Gurnee & Tegmark's dataset) + their Table 2 R².  Global: world cards."""
    rows = [r for r in csv.DictReader((EXT / "worldmodels" / "world_place.csv").open(encoding="utf-8")) if r["page_views"]]
    rows.sort(key=lambda r: -float(r["page_views"]))
    write("world", {"places": [[round(float(r["longitude"]), 2), round(float(r["latitude"]), 2)] for r in rows[:900]],
                    "r2": {"Llama-2-7B": 0.881, "Llama-2-13B": 0.896, "Llama-2-70B": 0.911}})  # Table 2, world, linear probe


def small_tables() -> None:
    """Local: antonym pairs, refusal grid + rates, WeightWatcher alphas, GPT-2 tokens, two images.  Global: cards."""
    pairs = [p for p in json.loads((EXT / "fv" / "antonym.json").read_text(encoding="utf-8")) if max(len(p["input"]), len(p["output"])) <= 9]
    write("antonyms", pairs[:14])
    ev = json.loads((EXT / "refusal" / "direction_evaluations.json").read_text(encoding="utf-8"))
    rate = lambda f: json.loads((EXT / "refusal" / f).read_text(encoding="utf-8"))  # noqa: E731  summary keys only, no completions
    positions, layers = sorted({e["position"] for e in ev}), sorted({e["layer"] for e in ev})
    grid = [[next(round(e["refusal_score"], 2) for e in ev if e["position"] == p and e["layer"] == l) for l in layers] for p in positions]
    write("refusal", {"positions": positions, "layers": layers, "refusalScore": grid,
                      "chosen": json.loads((EXT / "refusal" / "direction_metadata.json").read_text(encoding="utf-8")),
                      "jailbreakbench": {k: {m: rate(f"jailbreakbench_{k}_evaluations.json")[m]
                                             for m in ("substring_matching_success_rate", "llamaguard2_success_rate")}
                                         for k in ("baseline", "ablation")},
                      "harmlessActadd": rate("harmless_actadd_evaluations.json")["substring_matching_success_rate"]})
    ww = list(csv.DictReader((EXT / "ww" / "gpt2_small.csv").open(encoding="utf-8")))
    write("ww", [[int(r["layer_id"]), round(float(r["alpha"]), 3)] for r in ww if r["alpha"]])
    from tokenizers import Tokenizer  # GPT-2 byte-pair encoding
    tok = Tokenizer.from_file(str(EXT / "gpt2" / "tokenizer.json"))
    write("tokens", [{"text": t, "ids": e.ids, "tokens": e.tokens} for t in ["We will know", " The goal is to understand."]
                     for e in [tok.encode(t)]])
    from PIL import Image  # resize the two released figures
    img = Image.open(EXT / "goodfire" / "figure_1.png").convert("RGB")
    img.resize((1200, round(1200 * img.height / img.width))).save(OUT / "bsf_figure1.jpg", quality=85)  # MIT, Goodfire
    nb = json.loads((EXT / "tms" / "toy_models.ipynb").read_text(encoding="utf-8"))
    import base64  # the notebook's saved intro-figure output (Anthropic's own trained W, 10 sparsity levels)
    png = next(o["data"]["image/png"] for o in nb["cells"][9]["outputs"] if "image/png" in o.get("data", {}))
    (OUT / "tms_intro.png").write_bytes(base64.b64decode(png))
    for f in ["bsf_figure1.jpg", "tms_intro.png"]:
        log.info("Wrote video/public/vignettes/%s (%.1f KB)", f, (OUT / f).stat().st_size / 1024)


def main() -> None:
    """Local: download, derive, check, record.  Global: the whole data phase of exp07."""
    setup_logging(ROOT / "logs", prefix="exp07")  # logs/exp07_<ts>.log + terminal
    OUT.mkdir(parents=True, exist_ok=True)
    sources = download_all()
    checks: dict = {}
    grokking(checks)
    induction(checks)
    graphs()
    features()
    scale(checks)
    chinchilla()
    double_descent()
    world()
    small_tables()
    (DATA / "exp07_sources.json").write_text(json.dumps(sources, indent=2), encoding="utf-8")
    (DATA / "exp07_checks.json").write_text(json.dumps(checks, indent=2), encoding="utf-8")
    log_json(log, "exp07 pre-specified checks", checks)


if __name__ == "__main__":
    main()
