"""Bootstrap confidence intervals for medians of onset differences.

Local: median_ci resamples individual values (scipy.stats.bootstrap, percentile method);
cluster_median_ci resamples whole clusters (lyric lines) with replacement and keeps all their words.
Global context: words of one sung line share timing errors, so exp05's primary CI resamples lines
(Field & Welsh, 2007, "Bootstrapping clustered data", JRSS-B 69(3)); exp03 used the word-level CI.
Sources: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html ,
         numpy Generator.integers https://numpy.org/doc/stable/reference/random/generated/numpy.random.Generator.integers.html
"""

import numpy as np  # arrays + percentiles
from scipy import stats  # percentile bootstrap

NAN3 = (float("nan"), float("nan"), float("nan"))  # "no data" result


def median_ci(x, n_resamples: int = 5000, seed: int = 0) -> tuple[float, float, float]:
    """Local: (median, CI low, CI high), 95% percentile bootstrap over values.
    Global: error bars for onset disagreement (exp03 defaults: 5000 resamples, seed 0)."""
    x = np.asarray(x, dtype=float)  # accept lists
    if len(x) < 3:  # bootstrap is meaningless for 0-2 values
        return (float(np.median(x)), NAN3[1], NAN3[2]) if len(x) else NAN3
    res = stats.bootstrap((x,), np.median, confidence_level=0.95, n_resamples=n_resamples,
                          method="percentile", random_state=seed)  # seeded -> reproducible
    return float(np.median(x)), float(res.confidence_interval.low), float(res.confidence_interval.high)


def cluster_median_ci(x, clusters, n_resamples: int = 10_000, seed: int = 0) -> tuple[float, float, float]:
    """Local: median of x with a 95% percentile CI from resampling clusters with replacement.
    Global: exp05's primary uncertainty for the signed onset offset, with lines as clusters."""
    x, clusters = np.asarray(x, dtype=float), np.asarray(clusters)  # aligned arrays
    if len(x) < 3:
        return (float(np.median(x)), NAN3[1], NAN3[2]) if len(x) else NAN3
    groups = [x[clusters == c] for c in np.unique(clusters)]  # values of each cluster
    idx = np.random.default_rng(seed).integers(0, len(groups), size=(n_resamples, len(groups)))  # cluster draws
    meds = np.array([np.median(np.concatenate([groups[k] for k in row])) for row in idx])  # median per resample
    lo, hi = np.percentile(meds, [2.5, 97.5])  # percentile interval
    return float(np.median(x)), float(lo), float(hi)


def excludes_zero(ci) -> bool:
    """Local: True if a (low, high) interval lies strictly on one side of 0.  Global: decision condition D1/D4."""
    return bool(ci[0] > 0 or ci[1] < 0)  # NaN bounds compare False -> "does not exclude"


def density_decision(median: float, ci, margin: float | None = None) -> bool:
    """Local: the pre-specified density test. Without a margin, superiority: median > 0 and the CI excludes 0
    (exp07, "more detailed"). With a margin m, non-inferiority: the CI's lower bound is above −m (exp08, "not less
    detailed").  Global: validate_density.py.  Source: non-inferiority by the CI bound vs the margin, Piaggio et al.
    2012, CONSORT extension for non-inferiority trials, JAMA 308(24):2594, https://doi.org/10.1001/jama.2012.87802"""
    if margin is None:
        return bool(median > 0 and excludes_zero(ci))
    return bool(ci[0] > -margin)  # NaN compares False -> fails
