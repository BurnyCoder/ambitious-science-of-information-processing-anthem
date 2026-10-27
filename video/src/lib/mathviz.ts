/**
 * Pure, seeded math behind the "live math" figure cards.
 * Local: a tiny seeded PRNG, histograms, and the analytic or sampled quantities the cards plot: ReLU linear
 * regions, random-vector cosines, the Marchenko–Pastur density, the Chinchilla loss, deep-linear learning
 * curves, and the outputs of random wide networks. No imports, so `node --test tests/mathviz.test.ts` runs it.
 * Global: every function is deterministic in its seed, so cards stay pure functions of the frame
 * (Remotion's rendering model, https://www.remotion.dev/docs/the-fundamentals).
 * Sources: mulberry32 PRNG https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32 ;
 *          Box–Muller transform https://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform ;
 *          Marchenko–Pastur density https://en.wikipedia.org/wiki/Marchenko%E2%80%93Pastur_distribution ;
 *          Chinchilla L(N, D) = E + A/N^α + B/D^β (Hoffmann et al. 2022, arXiv:2203.15556, Eq. 2) ;
 *          deep-linear mode dynamics (Saxe, McClelland & Ganguli 2014, arXiv:1312.6120, Eq. 6) ;
 *          linear regions of ReLU nets (Montúfar et al. 2014, arXiv:1402.1869).
 */

/** Local: mulberry32, a 32-bit seeded PRNG returning floats in [0, 1). Global: all sampling below. */
export const prng = (seed: number): (() => number) => {
	let a = seed >>> 0; // 32-bit state
	return () => {
		a = (a + 0x6d2b79f5) >>> 0; // Weyl step
		let t = Math.imul(a ^ (a >>> 15), 1 | a); // mix
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; // mix again
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // to [0, 1)
	};
};

/** Local: standard normal samples by Box–Muller. Global: random weights and vectors. */
export const gaussian = (rand: () => number): (() => number) => () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());

/** Local: counts of values in `bins` equal-width bins over [lo, hi) (values outside are dropped). Global: histograms. */
export const histogram = (values: number[], lo: number, hi: number, bins: number): number[] => {
	const counts = new Array<number>(bins).fill(0); // empty bins
	for (const v of values) {
		const b = Math.floor(((v - lo) / (hi - lo)) * bins); // bin index
		if (b >= 0 && b < bins) counts[b] += 1;
	}
	return counts;
};

/** Local: cosines between n pairs of random Gaussian vectors in R^d. Global: concentration card (cos θ ≈ N(0, 1/d)). */
export const randomCosines = (d: number, n: number, seed: number): number[] => {
	const g = gaussian(prng(seed)); // seeded normals
	return Array.from({length: n}, () => {
		let dot = 0, na = 0, nb = 0; // running sums
		for (let i = 0; i < d; i++) {
			const a = g(), b = g();
			dot += a * b; na += a * a; nb += b * b;
		}
		return dot / Math.sqrt(na * nb); // cosine of the pair
	});
};

/** Local: Marchenko–Pastur density at x for aspect ratio q = N/M in (0, 1] and variance s2. Global: RMT card. */
export const marchenkoPastur = (x: number, q: number, s2 = 1): number => {
	const lo = s2 * (1 - Math.sqrt(q)) ** 2, hi = s2 * (1 + Math.sqrt(q)) ** 2; // support edges λ−, λ+
	if (x <= lo || x >= hi) return 0; // outside the bulk
	return Math.sqrt((hi - x) * (x - lo)) / (2 * Math.PI * s2 * q * x);
};

export type ChinchillaFit = {E: number; A: number; B: number; alpha: number; beta: number}; // parametric fit
/** Local: L(N, D) = E + A/N^α + B/D^β. Global: theory scene plot and scaling card. */
export const chinchillaLoss = (N: number, D: number, f: ChinchillaFit): number => f.E + f.A / N ** f.alpha + f.B / D ** f.beta;

/** Local: strength u(t) of one input–output mode of a deep linear net, from u0 to its singular value s
 * (Saxe et al. 2014): u = s e^{2st/τ} / (e^{2st/τ} − 1 + s/u0). Global: "solvable settings" card. */
export const saxeMode = (t: number, s: number, u0: number, tau = 1): number => {
	const e = Math.exp((2 * s * t) / tau); // growth factor
	return (s * e) / (e - 1 + s / u0);
};

/** Local: outputs f = Σ v_i ReLU(w_i) / √width of n random one-hidden-layer nets at input x = 1.
 * Global: "width → ∞" card; the distribution tends to a Gaussian (Neal 1996). */
export const randomNetOutputs = (width: number, n: number, seed: number): number[] => {
	const g = gaussian(prng(seed)); // seeded normals
	return Array.from({length: n}, () => {
		let f = 0;
		for (let i = 0; i < width; i++) f += g() * Math.max(0, g()); // v_i · ReLU(w_i · 1)
		return f / Math.sqrt(width); // NTK / NNGP scaling
	});
};

export type ReluNet = {W1: number[][]; b1: number[]; W2: number[][]; b2: number[]}; // 2 -> h -> h
/** Local: a seeded random 2 -> h -> h ReLU net with N(0, 1) weights and small biases. Global: regions card. */
export const randomReluNet = (h: number, seed: number): ReluNet => {
	const g = gaussian(prng(seed));
	const mat = (r: number, c: number) => Array.from({length: r}, () => Array.from({length: c}, g)); // r x c normals
	return {W1: mat(h, 2), b1: Array.from({length: h}, () => 0.5 * g()), W2: mat(h, h), b2: Array.from({length: h}, () => 0.5 * g())};
};

/** Local: activation-pattern id of input (x, y) using layer 1 only (depth 1) or both layers (depth 2).
 * Inputs with the same id lie in the same linear region. Global: regions card colors. */
export const reluPattern = (net: ReluNet, x: number, y: number, depth: 1 | 2): string => {
	const h1 = net.W1.map((w, i) => Math.max(0, w[0] * x + w[1] * y + net.b1[i])); // layer-1 ReLU outputs
	let id = h1.map((v) => (v > 0 ? '1' : '0')).join(''); // which units are on
	if (depth === 2) id += '|' + net.W2.map((w, i) => (w.reduce((s, wij, j) => s + wij * h1[j], net.b2[i]) > 0 ? '1' : '0')).join('');
	return id;
};
