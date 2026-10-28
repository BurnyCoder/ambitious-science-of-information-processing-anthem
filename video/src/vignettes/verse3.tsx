/**
 * Verse 3 cards: the five pillars of a scientific theory of deep learning, plus "predict it before you train it".
 * Local: saxe (live analytic deep-linear learning curves), nngp (live output histograms of random nets at growing
 * width), weightDecay (test loss of two released grokking runs with weight decay 1.0 and 0.1), collapse
 * (schematic neural collapse + edge of stability), gpt4 (schematic of GPT-4 report Fig. 1).
 * Global: registered in ./index.ts; each pillar card docks into its glowing pillar in TheoryScene (stage/anchors.ts).
 * Sources: Saxe et al. 2014; Neal 1996; Nanda et al. 2023 saved runs; Papyan et al. 2020; Cohen et al. 2021; OpenAI 2023.
 */
import React from 'react'; // JSX
import {COLORS, FONTS, smooth} from '../lib/theme'; // look
import {histogram, randomNetOutputs, saxeMode} from '../lib/mathviz'; // live math
import {Plot, type BodyProps} from './primitives'; // building blocks
import grok from '../../public/vignettes/grokking.json'; // released runs

const memo = <T,>(f: () => T) => { let v: T | undefined; return () => (v ??= f()); }; // compute once per render tab

/** Mode strengths u(t) for singular values 3, 2, 1, 0.5: each learned in a sigmoidal step, strongest first. */
export const Saxe: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const ts = Array.from({length: 121}, (_, i) => i * 0.05); // time 0..6
	const colors = [accent, COLORS.magenta, COLORS.amber, COLORS.lime];
	return (
		<Plot w={w} h={h} x={{domain: [0, 6], label: 'time'}} y={{domain: [0, 3.2], label: 'mode strength'}} draw={smooth(local / 2.5)}
			series={[3, 2, 1, 0.5].map((s, i) => ({pts: ts.map((t) => [t, saxeMode(t, s, 0.001)] as [number, number]), color: colors[i]}))}>
			{(sx, sy) => [3, 2, 1, 0.5].map((s, i) => <text key={s} x={sx(5.2)} y={sy(s) - 4} fill={colors[i]} fontFamily={FONTS.mono} fontSize={11}>s={s}</text>)}
		</Plot>
	);
};

const nets = memo(() => [1, 4, 64].map((width, i) => { // output histograms per width
	const c = histogram(randomNetOutputs(width, 4000, 40 + i), -3, 3, 30);
	const m = Math.max(...c);
	return {width, pts: c.map((v, b) => [-3 + (b + 0.5) * 0.2, v / m] as [number, number])};
}));

/** As width grows the output distribution of a random net becomes Gaussian (stacked panels). */
export const Nngp: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const ph = h / 3;
	return (
		<div style={{position: 'absolute', inset: 0}}>
			{nets().map((n, i) => (
				<div key={n.width} style={{position: 'absolute', top: i * ph, width: w, height: ph - 4, opacity: smooth(local * 2 - i * 0.7)}}>
					<Plot w={w} h={ph - 4} x={{domain: [-3, 3]}} y={{domain: [0, 1.05]}} series={[{pts: n.pts, color: [COLORS.magenta, COLORS.amber, accent][i]}]} draw={smooth(local * 1.5 - i * 0.5)} />
					<div style={{position: 'absolute', top: 2, right: 2, fontFamily: FONTS.mono, fontSize: 12, color: COLORS.ink}}>width {n.width}</div>
				</div>
			))}
		</div>
	);
};

/** Test loss of the same task with weight decay 1.0 (mainline) and 0.1: the drop comes ~9× later. */
export const WeightDecay: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const colors = [accent, COLORS.magenta];
	return (
		<Plot w={w} h={h} x={{domain: [100, 110000], log: true, label: 'epoch'}} y={{domain: [1e-7, 10], log: true, label: 'test loss'}} draw={smooth(local / 3)}
			series={grok.wd.map((r, i) => ({pts: (r.test as [number, number][]).filter(([e]) => e >= 100), color: colors[i]}))}>
			{(sx, sy) => grok.wd.map((r, i) => (
				<g key={i} opacity={smooth(local - 1 - i)}>
					<line x1={sx(r.testBelow1At)} y1={sy(10)} x2={sx(r.testBelow1At)} y2={sy(1e-7)} stroke={colors[i]} strokeDasharray="3 4" />
					<text x={sx(r.testBelow1At) - 3} y={sy(i ? 1e-5 : 1e-3)} fill={colors[i]} fontFamily={FONTS.mono} fontSize={11} textAnchor="end">wd {r.weightDecay}</text>
				</g>
			))}
		</Plot>
	);
};

/** Class means collapsing onto the vertices of a simplex, then sharpness rising to 2/η and hovering. */
export const Collapse: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const c = smooth(local / 3); // collapse progress
	const R = w * 0.38, cx = w / 2, cy = h * 0.27;
	const verts = [0, 1, 2].map((k) => [cx + R * Math.cos(-Math.PI / 2 + (k * 2 * Math.PI) / 3), cy + R * Math.sin(-Math.PI / 2 + (k * 2 * Math.PI) / 3)]);
	const sharp = Array.from({length: 80}, (_, i) => [i, Math.min(1, i / 30) * (1 + 0.05 * Math.sin(i * 1.7))] as [number, number]); // EoS schematic
	return (
		<div style={{position: 'absolute', inset: 0}}>
			<svg width={w} height={h * 0.55} style={{position: 'absolute'}}>
				<polygon points={verts.map((v) => v.join(',')).join(' ')} fill="none" stroke={COLORS.dim} strokeDasharray="4 4" />
				{verts.flatMap(([vx, vy], k) => Array.from({length: 14}, (_, i) => {
					const a = i * 2.4 + k, r = (1 - c) * 26;
					return <circle key={`${k}${i}`} cx={vx + r * Math.cos(a)} cy={vy + r * Math.sin(a)} r={3} fill={[accent, COLORS.magenta, COLORS.lime][k]} />;
				}))}
			</svg>
			<div style={{position: 'absolute', top: h * 0.58, width: w, height: h * 0.42}}>
				<Plot w={w} h={h * 0.42} x={{domain: [0, 80], label: 'step'}} y={{domain: [0, 1.3], label: 'sharpness'}} series={[{pts: sharp, color: COLORS.amber}]} draw={smooth((local - 1) / 2.5)}>
					{(sx, sy) => <g><line x1={sx(0)} y1={sy(1)} x2={sx(80)} y2={sy(1)} stroke={COLORS.ink} strokeDasharray="4 4" /><text x={sx(2)} y={sy(1.08)} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={11}>2/η</text></g>}
				</Plot>
			</div>
		</div>
	);
};

/** Small runs on a loss-vs-compute axis, a fitted power law, and the big run landing on the prediction. */
export const Gpt4: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const L = (c: number) => 1.2 + 0.9 * c ** -0.05; // schematic power law in compute (big run = 1); stays within the 1..6 axis
	const small = [1e-10, 1e-9, 1e-8, 1e-7, 1e-6, 1e-5, 1e-4]; // fractions of the big run's compute
	const land = smooth((local - 2) / 0.6); // big run appears
	return (
		<Plot w={w} h={h} x={{domain: [1e-10, 1], log: true, label: 'compute (big run = 1)'}} y={{domain: [1, 6], label: 'loss'}} draw={smooth(local / 2)}
			series={[{pts: Array.from({length: 50}, (_, i) => [10 ** (-10 + i * 0.205), L(10 ** (-10 + i * 0.205))] as [number, number]), color: COLORS.dim, width: 2}]}>
			{(sx, sy) => (
				<g>
					{small.map((c) => <circle key={c} cx={sx(c)} cy={sy(L(c))} r={5} fill={COLORS.ink} />)}
					<circle cx={sx(1)} cy={sy(L(1))} r={9} fill={accent} opacity={land} style={{filter: `drop-shadow(0 0 8px ${accent})`}} />
					<text x={sx(1) - 10} y={sy(L(1)) - 14} fill={accent} fontFamily={FONTS.mono} fontSize={13} textAnchor="end" opacity={land}>trained later: on the line</text>
				</g>
			)}
		</Plot>
	);
};
