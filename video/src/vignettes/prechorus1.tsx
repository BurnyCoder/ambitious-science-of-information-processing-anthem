/**
 * Pre-chorus 1 cards: "Down through a billion-dimensional night, past every saddle, to valleys flat and wide".
 * Local: concentration (live cosine histograms at d = 3, 100, 10⁴), saddle (schematic z = x² − y² with an escaping
 * iterate and a bulk-plus-outliers Hessian spectrum), flat (schematic sharp vs flat minimum under a ±ρ
 * perturbation), doubleDescent (Nakkiran et al. Fig. 1 data), grokking (Nanda et al. mainline run), curves
 * (schematic curve-detector family).
 * Global: registered in ./index.ts. Sources: see content/vignettes.toml citations; data in ../../public/vignettes/.
 */
import React from 'react'; // JSX
import {COLORS, FONTS, smooth} from '../lib/theme'; // look
import {histogram, randomCosines} from '../lib/mathviz'; // live math
import {Plot, type BodyProps} from './primitives'; // building blocks
import dd from '../../public/vignettes/double_descent.json'; // ResNet18 width sweep, 15 % label noise
import grok from '../../public/vignettes/grokking.json'; // mainline grokking run

const memo = <T,>(f: () => T) => { let v: T | undefined; return () => (v ??= f()); }; // compute once per render tab
const BINS = 40; // histogram resolution over [-1, 1]
const cosHists = memo(() => [[3, 6000], [100, 3000], [10000, 400]].map(([d, n], i) => { // [dimension, pairs]
	const c = histogram(randomCosines(d, n, 100 + i), -1, 1, BINS);
	const m = Math.max(...c);
	return {d, pts: c.map((v, b) => [-1 + (b + 0.5) * (2 / BINS), v / m] as [number, number])}; // peak-normalized
}));

/** Cosines of random pairs pile up at 0 as the dimension grows. */
export const Concentration: React.FC<BodyProps> = ({local, w, h}) => {
	const colors = [COLORS.violet, COLORS.magenta, COLORS.cyan];
	return (
		<Plot w={w} h={h} x={{domain: [-1, 1], label: 'cos θ between two random vectors'}} y={{domain: [0, 1.05]}}
			series={cosHists().map((s, i) => ({pts: s.pts, color: colors[i]}))} draw={smooth(local / 2)}>
			{(sx, sy) => cosHists().map((s, i) => (
				<text key={s.d} x={sx(0.35)} y={sy(0.95 - i * 0.14)} fill={colors[i]} fontFamily={FONTS.mono} fontSize={14} opacity={smooth(local * 2 - i)}>d = {s.d.toLocaleString('en-US')}</text>))}
		</Plot>
	);
};

/** A saddle: an iterate slides off along the negative-curvature direction; the Hessian has a bulk and outliers. */
export const Saddle: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const half = w * 0.55, n = 18; // contour panel width, grid size
	const s = Math.min(local / 3, 1) * 1.6; // flow time
	const ix = 0.9 * Math.exp(-2 * s), iy = Math.min(0.95, 0.05 * Math.exp(2 * s)); // gradient flow on x² − y²: x shrinks, y escapes
	const toX = (u: number) => (u + 1) / 2 * (half - 10), toY = (v: number) => (1 - (v + 1) / 2) * (h - 10);
	const eig: [number, number][] = [[-1.4, 0.12], [0, 1], [2.3, 0.12], [3.6, 0.12]]; // schematic spectrum: (eigenvalue, relative count)
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			{Array.from({length: n * n}, (_, i) => { const u = (i % n) / (n - 1) * 2 - 1, v = Math.floor(i / n) / (n - 1) * 2 - 1, z = u * u - v * v;
				return <rect key={i} x={toX(u)} y={toY(v)} width={(half - 10) / n + 1} height={(h - 10) / n + 1} fill={z > 0 ? COLORS.cyan : COLORS.magenta} opacity={0.12 + 0.5 * Math.abs(z)} />; })}
			<circle cx={toX(ix)} cy={toY(iy)} r={7} fill={COLORS.amber} style={{filter: `drop-shadow(0 0 6px ${COLORS.amber})`}} />
			<text x={4} y={14} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={13}>L = x² − y²</text>
			<g transform={`translate(${half + 14} 0)`}>
				{eig.map(([e, c], i) => <rect key={i} x={((e + 2) / 6.2) * (w - half - 30)} y={h - 30 - c * (h - 60)} width={12} height={c * (h - 60)} fill={e < 0 ? COLORS.magenta : accent} opacity={0.85} />)}
				<text x={((0 + 2) / 6.2) * (w - half - 30) + 6} y={22} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={11} textAnchor="middle">bulk ≈ 0</text>
				<text x={((-1.4 + 2) / 6.2) * (w - half - 30)} y={h - 46} fill={COLORS.magenta} fontFamily={FONTS.mono} fontSize={11}>&lt;0</text>
				<line x1={0} y1={h - 30} x2={w - half - 20} y2={h - 30} stroke={COLORS.dim} />
				<text x={0} y={h - 12} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={12}>Hessian eigenvalues</text>
			</g>
		</svg>
	);
};

const sharp = (x: number) => 2.6 - 2.2 * Math.exp(-((x + 1.6) ** 2) / 0.04); // narrow well
const wide = (x: number) => 2.6 - 2.0 * Math.exp(-((x - 1.1) ** 2) / 0.9); // wide well
const curve = Array.from({length: 241}, (_, i) => -3 + i * 0.025).map((x) => [x, Math.min(sharp(x), wide(x))] as [number, number]);

/** Shake the weights by ±ρ: the sharp minimum's loss jumps, the flat one barely moves. */
export const Flat: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const shake = 0.3 * Math.sin(local * 6); // ±ρ perturbation
	return (
		<Plot w={w} h={h} x={{domain: [-3, 3], label: 'weights'}} y={{domain: [0, 2.8], label: 'loss'}} series={[{pts: curve, color: accent}]} draw={smooth(local / 1.2)}>
			{(sx, sy) => [[-1.6, 'sharp', COLORS.magenta], [1.1, 'flat', COLORS.lime]].map(([c, l, col]) => {
				const x = (c as number) + shake, y = Math.min(sharp(x), wide(x));
				return (
					<g key={l as string}>
						<rect x={sx((c as number) - 0.3)} y={sy(2.75)} width={sx(0.3) - sx(-0.3)} height={sy(0) - sy(2.75)} fill={col as string} opacity={0.08} />
						<circle cx={sx(x)} cy={sy(y)} r={7} fill={col as string} />
						<text x={sx(c as number)} y={sy(2.45)} fill={col as string} fontFamily={FONTS.mono} fontSize={14} textAnchor="middle">{l as string}: ΔL = {(y - Math.min(sharp(c as number), wide(c as number))).toFixed(2)}</text>
					</g>
				);
			})}
		</Plot>
	);
};

/** Test error vs width: down, up at the interpolation threshold, down again (5 trials, band = min–max). */
export const DoubleDescent: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const band = dd.k.map((k, i) => [k, dd.testMin[i], dd.testMax[i]]);
	return (
		<Plot w={w} h={h} x={{domain: [1, 64], label: 'ResNet18 width k'}} y={{domain: [0, 0.55], label: 'error'}} draw={smooth(local / 2.2)}
			series={[{pts: dd.k.map((k, i) => [k, dd.trainMean[i]] as [number, number]), color: COLORS.violet}, {pts: dd.k.map((k, i) => [k, dd.testMean[i]] as [number, number]), color: accent, width: 3}]}>
			{(sx, sy) => (
				<g>
					<path d={`M ${band.map(([k, lo]) => `${sx(k)} ${sy(lo)}`).join(' L ')} L ${band.slice().reverse().map(([k, , hi]) => `${sx(k)} ${sy(hi)}`).join(' L ')} Z`} fill={accent} opacity={0.15} />
					<text x={sx(10)} y={sy(0.34)} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={13} textAnchor="middle" opacity={smooth(local - 1.2)}>peak k = 10</text>
					<text x={sx(40)} y={sy(0.22)} fill={accent} fontFamily={FONTS.mono} fontSize={13}>test</text>
					<text x={sx(40)} y={sy(0.05)} fill={COLORS.violet} fontFamily={FONTS.mono} fontSize={13}>train</text>
				</g>
			)}
		</Plot>
	);
};

/** Train and test loss of the released mainline run on log axes, with the paper's three phases shaded. */
export const Grokking: React.FC<BodyProps> = ({local, w, h, accent}) => (
	<Plot w={w} h={h} x={{domain: [10, 50000], log: true, label: 'epoch'}} y={{domain: [1e-7, 10], log: true, label: 'loss'}} draw={smooth(local / 2.5)}
		series={[{pts: grok.train.filter(([e]) => e >= 10) as [number, number][], color: COLORS.violet}, {pts: grok.test.filter(([e]) => e >= 10) as [number, number][], color: accent, width: 3}]}>
		{(sx, sy) => (
			<g>
				{[[10, grok.phases[0], 'memorize'], [grok.phases[0], grok.phases[1], 'circuit forms'], [grok.phases[1], grok.phases[2], 'cleanup']].map(([a, b, l], i) => (
					<g key={i}>
						<rect x={sx(a as number)} y={sy(10)} width={sx(b as number) - sx(a as number)} height={sy(1e-7) - sy(10)} fill={[COLORS.magenta, COLORS.amber, COLORS.lime][i]} opacity={0.08} />
						<text x={(sx(a as number) + sx(b as number)) / 2} y={sy([1e-6, 1e-4, 1e-2][i])} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={11} textAnchor="middle">{l as string}</text>
					</g>
				))}
				<text x={sx(60)} y={sy(2e-5)} fill={COLORS.violet} fontFamily={FONTS.mono} fontSize={13}>train</text>
				<text x={sx(60)} y={sy(2.5)} fill={accent} fontFamily={FONTS.mono} fontSize={13}>test</text>
			</g>
		)}
	</Plot>
);

/** A family of curve detectors, one per orientation; the unit matching the rotating curve lights up. */
export const Curves: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const n = 10, cols = 5, cw = w / cols, ch = (h - 8) / 2; // 10 units in 2 rows
	const angle = (local * 120) % 360; // stimulus orientation
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			{Array.from({length: n}, (_, i) => {
				const th = (i * 360) / n, cx = (i % cols) * cw + cw / 2, cy = Math.floor(i / cols) * ch + ch / 2;
				const resp = Math.max(0, Math.cos(((angle - th) * Math.PI) / 180)) ** 4; // tuning curve
				const r = Math.min(cw, ch) * 0.3;
				return (
					<g key={i} transform={`translate(${cx} ${cy}) rotate(${th})`}>
						<rect x={-cw / 2 + 4} y={-ch / 2 + 4} width={cw - 8} height={ch - 8} rx={6} fill={accent} opacity={0.08 + 0.5 * resp} />
						<path d={`M ${-r} ${r * 0.4} A ${r} ${r} 0 0 1 ${r} ${r * 0.4}`} stroke={COLORS.ink} strokeWidth={3 + 3 * resp} fill="none" opacity={0.4 + 0.6 * resp} />
					</g>
				);
			})}
		</svg>
	);
};
