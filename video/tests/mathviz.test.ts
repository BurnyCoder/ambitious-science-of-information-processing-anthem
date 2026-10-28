/**
 * Known-answer tests for src/lib/mathviz.ts (run with `npm test`, i.e. node --test with built-in type stripping).
 * Local: each function is checked against a value it must reproduce by construction or by theory.
 * Global: the "live math" cards draw these numbers, so they must be right. Sources: see mathviz.ts.
 */
import {test} from 'node:test'; // built-in runner https://nodejs.org/api/test.html
import assert from 'node:assert/strict'; // assertions
import {chinchillaLoss, criticalPoint, hessian2, histogram, marchenkoPastur, prng, randomCosines, randomNetOutputs, randomReluNet, reluPattern, saxeMode, sym2Eig} from '../src/lib/mathviz.ts';

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length; // sample mean
const variance = (v: number[]) => mean(v.map((x) => (x - mean(v)) ** 2)); // sample variance

test('prng is deterministic and uniform-ish', () => {
	const a = prng(7), b = prng(7);
	const xs = Array.from({length: 5000}, a);
	assert.deepEqual(xs.slice(0, 3), [b(), b(), b()]); // same seed, same stream
	assert.ok(Math.abs(mean(xs) - 0.5) < 0.02); // mean of U[0,1)
});

test('random cosines concentrate as N(0, 1/d)', () => {
	const c = randomCosines(400, 400, 1);
	assert.ok(Math.abs(mean(c)) < 0.01); // centred at 0
	assert.ok(Math.abs(variance(c) * 400 - 1) < 0.2); // variance ≈ 1/d
});

test('Marchenko–Pastur density integrates to 1 on its support', () => {
	const q = 0.5, lo = (1 - Math.sqrt(q)) ** 2, hi = (1 + Math.sqrt(q)) ** 2, n = 20000;
	let s = 0;
	for (let i = 0; i < n; i++) s += marchenkoPastur(lo + ((i + 0.5) / n) * (hi - lo), q) * ((hi - lo) / n); // midpoint rule
	assert.ok(Math.abs(s - 1) < 1e-3);
	assert.equal(marchenkoPastur(hi + 0.1, q), 0); // zero outside the bulk
});

test('Chinchilla loss uses the published form', () => {
	const f = {E: 1.6934, A: 406.4, B: 410.7, alpha: 0.3392, beta: 0.2849};
	assert.ok(Math.abs(chinchillaLoss(70e9, 1.4e12, f) - (1.6934 + 406.4 / 70e9 ** 0.3392 + 410.7 / 1.4e12 ** 0.2849)) < 1e-12);
	assert.ok(chinchillaLoss(70e9, 1.4e12, f) < chinchillaLoss(1e9, 20e9, f)); // bigger model + more data -> lower loss
});

test('deep-linear mode goes from u0 to s', () => {
	assert.ok(Math.abs(saxeMode(0, 3, 0.01) - 0.01) < 1e-12); // starts at u0
	assert.ok(Math.abs(saxeMode(20, 3, 0.01) - 3) < 1e-6); // ends at the singular value
});

test('random wide nets have finite output variance E[ReLU(w)^2] = 1/2', () => {
	const f = randomNetOutputs(256, 2000, 3);
	assert.ok(Math.abs(variance(f) - 0.5) < 0.06); // Var = E[v^2] E[ReLU(w)^2] = 1/2
});

test('a second ReLU layer refines the regions of the first', () => {
	const net = randomReluNet(12, 5);
	const ids = (d: 1 | 2) => new Set(Array.from({length: 60 * 60}, (_, i) => reluPattern(net, (i % 60) / 10 - 3, Math.floor(i / 60) / 10 - 3, d)));
	assert.ok(ids(2).size >= ids(1).size); // composition can only split regions
	assert.deepEqual(histogram([0, 0.5, 0.99, 2], 0, 1, 2), [1, 2]); // helper: [0,.5) and [.5,1)
});

test('sym2Eig diagonalizes a symmetric 2x2 matrix', () => {
	const {values, vectors} = sym2Eig([[2, 1], [1, 2]]); // eigenvalues 1 and 3, eigenvectors (1,-1)/√2 and (1,1)/√2
	assert.ok(Math.abs(values[0] - 1) < 1e-12 && Math.abs(values[1] - 3) < 1e-12); // ascending
	vectors.forEach(([x, y], i) => { // A v = λ v
		assert.ok(Math.abs(2 * x + y - values[i] * x) < 1e-12 && Math.abs(x + 2 * y - values[i] * y) < 1e-12);
		assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-12); // unit length
	});
	assert.deepEqual(sym2Eig([[-1, 0], [0, 4]]).values, [-1, 4]); // already diagonal
});

test('hessian2 and criticalPoint find the saddle of x² − y² and the minimum of a bowl', () => {
	const saddle = (x: number, y: number) => (x - 1) ** 2 - (y + 2) ** 2; // saddle at (1, -2), Hessian diag(2, -2)
	const p = criticalPoint(saddle, [0.3, -1.1])!;
	assert.ok(Math.abs(p[0] - 1) < 1e-6 && Math.abs(p[1] + 2) < 1e-6);
	const {values} = sym2Eig(hessian2(saddle, p[0], p[1]));
	assert.ok(Math.abs(values[0] + 2) < 1e-4 && Math.abs(values[1] - 2) < 1e-4); // one negative, one positive
	assert.equal(criticalPoint((x, y) => Math.exp(x) + y, [0, 0]), null); // no critical point -> null
});
