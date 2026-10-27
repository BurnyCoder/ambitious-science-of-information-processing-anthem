/**
 * Verse 1 cards: "A matrix and a bend, repeated without end ... gradient by gradient".
 * Local: matmul (live W·h), activations (live ReLU/GELU/SiLU), scale (Epoch AI params vs year), regions (live
 * linear regions of a ReLU net), residual (schematic residual stream), induction (ARENA's per-head scores for
 * GPT-2 small), backprop (forward and backward passes on a small graph).
 * Global: registered in ./index.ts; data from ../../public/vignettes/ (scripts/vignette_data.py).
 * Sources: GELU tanh approximation, Hendrycks & Gimpel 2016 (arXiv:1606.08415) Eq. 2; SiLU x·σ(x), Elfwing et al.
 * 2018 (arXiv:1702.03118); Epoch AI Notable AI Models (CC BY 4.0); ARENA 3.0 induction scores; linear regions,
 * Montúfar et al. 2014; residual stream, Elhage et al. 2021.
 */
import React from 'react'; // JSX
import {random} from 'remotion'; // seeded values
import {COLORS, FONTS, smooth} from '../lib/theme'; // look
import {randomReluNet, reluPattern} from '../lib/mathviz'; // live math
import {Graph, Heatmap, Plot, human, type BodyProps} from './primitives'; // building blocks
import scaleData from '../../public/vignettes/scale.json'; // Epoch AI points + milestones
import induction from '../../public/vignettes/induction.json'; // ARENA 12x12 grid

const memo = <T,>(f: () => T) => { let v: T | undefined; return () => (v ??= f()); }; // compute once per render tab

/** W·h with numbers: the active row lights up, its dot product fills the output. */
export const Matmul: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const W = Array.from({length: 4}, (_, r) => Array.from({length: 4}, (_, c) => Math.round((random(`W${r}${c}`) * 2 - 1) * 9) / 10)); // seeded entries
	const x = [0.8, -0.4, 0.3, 1.0]; // input vector
	const y = W.map((row) => row.reduce((s, v, c) => s + v * x[c], 0)); // W·x
	const row = Math.floor(local * 1.6) % 4; // row being multiplied
	const cs = Math.min(h / 4.6, w / 9.4); // cell size
	const cell = (v: number, cx: number, cy: number, on: boolean, key: string) => (
		<g key={key}>
			<rect x={cx} y={cy} width={cs - 4} height={cs - 4} rx={4} fill={v >= 0 ? COLORS.cyan : COLORS.magenta} opacity={0.15 + 0.6 * Math.min(1, Math.abs(v))} stroke={on ? COLORS.ink : 'none'} strokeWidth={2} />
			<text x={cx + (cs - 4) / 2} y={cy + cs * 0.6} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={cs * 0.32} textAnchor="middle">{v.toFixed(1)}</text>
		</g>
	);
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			<g transform={`translate(0 ${cs * 0.4})`}>
				{W.map((r, i) => r.map((v, c) => cell(v, c * cs, i * cs, i === row, `w${i}${c}`)))}
				<text x={4.15 * cs} y={2.2 * cs} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={cs * 0.5}>·</text>
				{x.map((v, i) => cell(v, 4.5 * cs, i * cs, false, `x${i}`))}
				<text x={5.65 * cs} y={2.2 * cs} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={cs * 0.5}>=</text>
				{y.map((v, i) => cell(i <= row || local > 2.5 ? v : 0, 6.2 * cs, i * cs, i === row, `y${i}`))}
				<text x={7.5 * cs} y={2.2 * cs} fill={accent} fontFamily={FONTS.mono} fontSize={cs * 0.38}>→ σ</text>
			</g>
		</svg>
	);
};

const gelu = (x: number) => 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3))); // tanh approximation
const silu = (x: number) => x / (1 + Math.exp(-x)); // x·σ(x)
const xs = Array.from({length: 121}, (_, i) => -3 + i * 0.05); // sample points

/** Three common bends, drawn left to right. */
export const Activations: React.FC<BodyProps> = ({local, w, h}) => (
	<Plot w={w} h={h} x={{domain: [-3, 3], label: 'z'}} y={{domain: [-0.6, 3], label: 'σ(z)'}} draw={smooth(local / 1.6)}
		series={[{pts: xs.map((x) => [x, Math.max(0, x)]), color: COLORS.cyan}, {pts: xs.map((x) => [x, gelu(x)]), color: COLORS.magenta}, {pts: xs.map((x) => [x, silu(x)]), color: COLORS.amber}]}>
		{(sx, sy) => [['ReLU', 2.2, 2.75, COLORS.cyan], ['GELU', -2.9, 0.55, COLORS.magenta], ['SiLU', -2.9, 0.95, COLORS.amber]].map(([l, a, b, c]) => (
			<text key={l as string} x={sx(a as number)} y={sy(b as number)} fill={c as string} fontFamily={FONTS.mono} fontSize={14}>{l as string}</text>))}
	</Plot>
);

/** Every notable model's parameter count by year (dots), with labelled milestones appearing in order. */
export const Scale: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const reveal = smooth(local / 3);
	return (
		<Plot w={w} h={h} x={{domain: [1955, 2027], label: 'year'}} y={{domain: [2, 13], label: 'log₁₀ params'}} series={[]}>
			{(sx, sy) => (
				<g>
					{scaleData.points.map(([yr, lp], i) => <circle key={i} cx={sx(yr)} cy={sy(lp)} r={1.6} fill={COLORS.violet} opacity={0.55 * Math.min(1, reveal * 2)} />)}
					{(() => { let last = -99; // label repel: keep 14 px between label baselines, top to bottom
						return [...scaleData.marks].sort((a, b) => b.params - a.params).map((m) => {
							const i = scaleData.marks.indexOf(m), on = smooth(reveal * (scaleData.marks.length + 1) - i); // one by one, in time order
							const lp = Math.log10(m.params), ly = (last = Math.max(sy(lp) - 6, last + 14));
							return (
								<g key={m.name} opacity={on}>
									<circle cx={sx(m.year)} cy={sy(lp)} r={5} fill={accent} />
									<line x1={sx(m.year) - 5} y1={sy(lp)} x2={sx(m.year) - 14} y2={ly - 4} stroke={COLORS.dim} />
									<text x={sx(m.year) - 16} y={ly} fill={COLORS.ink} fontFamily={FONTS.body} fontSize={12} textAnchor="end">{m.name.replace(' (davinci)', '').replace(' (1.5B)', '').replace(' (540B)', '')} {human(m.params)}</text>
								</g>
							);
						}); })()}
				</g>
			)}
		</Plot>
	);
};

const GRID = [64, 36] as const; // cells across the input square
const regionNet = memo(() => randomReluNet(10, 11)); // fixed random 2 -> 10 -> 10 net
const regionIds = memo(() => ([1, 2] as const).map((d) => Array.from({length: GRID[0] * GRID[1]}, (_, i) => reluPattern(regionNet(), (i % GRID[0]) / GRID[0] * 6 - 3, Math.floor(i / GRID[0]) / GRID[1] * 4 - 2, d))));
const hue = (id: string) => { let hsh = 0; for (const ch of id) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; return hsh % 360; }; // region -> color

/** Linear regions after one layer, then after two (each color = one linear piece). */
export const Regions: React.FC<BodyProps> = ({local, w, h}) => {
	const depth = local < 2.2 ? 0 : 1; // switch to two layers after 2.2 s
	const ids = regionIds()[depth];
	const cw = w / GRID[0], ch = (h - 20) / GRID[1];
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			{ids.map((id, i) => <rect key={i} x={(i % GRID[0]) * cw} y={Math.floor(i / GRID[0]) * ch} width={cw + 0.5} height={ch + 0.5} fill={`hsl(${hue(id)} 70% 45%)`} opacity={0.85} />)}
			<text x={4} y={h - 4} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={13}>{depth ? 2 : 1} ReLU layer{depth ? 's' : ''}: {new Set(ids).size} linear regions in view</text>
		</svg>
	);
};

/** The residual stream: blocks read from it and add back into it, a pulse climbs to the unembedding. */
export const Residual: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const blocks = ['Attn 1', 'MLP 1', 'Attn 2', 'MLP 2', '…', 'MLP L']; // bottom to top
	const pulse = (local * 0.9) % 1; // position of the travelling signal (0 bottom, 1 top)
	const cx = w * 0.32, top = 16, bot = h - 16; // stream line
	const yAt = (i: number) => bot - ((i + 1) / (blocks.length + 1)) * (bot - top);
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			<line x1={cx} y1={bot} x2={cx} y2={top} stroke={accent} strokeWidth={6} opacity={0.7} />
			<circle cx={cx} cy={bot - pulse * (bot - top)} r={8} fill={COLORS.ink} style={{filter: `drop-shadow(0 0 8px ${accent})`}} />
			<text x={cx} y={bot + 2} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={12} textAnchor="middle" dominantBaseline="hanging">x₀ = embed(token)</text>
			{blocks.map((b, i) => (
				<g key={b}>
					<path d={`M ${cx} ${yAt(i) + 10} C ${cx + 40} ${yAt(i) + 10}, ${cx + 40} ${yAt(i)}, ${cx + 70} ${yAt(i)}`} stroke={COLORS.dim} fill="none" />
					<rect x={cx + 70} y={yAt(i) - 12} width={88} height={24} rx={6} fill="rgba(139,92,255,0.25)" stroke={b.startsWith('Attn') ? COLORS.magenta : COLORS.cyan} />
					<text x={cx + 114} y={yAt(i) + 5} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={13} textAnchor="middle">{b}</text>
					<text x={cx - 10} y={yAt(i) - 2} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={14} textAnchor="end">+</text>
				</g>
			))}
			<text x={cx + 180} y={top + 10} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={13}>→ unembed → softmax</text>
		</svg>
	);
};

/** ARENA's induction score for every head of GPT-2 small; the top five are ringed. */
export const Induction: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const rings = induction.top.map((t) => t.head.split('.').map(Number) as [number, number]); // [layer, head]
	const gw = Math.min(w * 0.62, h * 1.0); // square grid
	return (
		<div style={{position: 'absolute', inset: 0}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: gw, height: h}}>
				<Heatmap w={gw} h={h} z={induction.z} color={accent} reveal={smooth(local / 1.5)} lo={0} hi={1} rings={rings} xLabel="head" yLabel="layer" />
			</div>
			<div style={{position: 'absolute', left: gw + 12, top: 4, fontFamily: FONTS.mono, fontSize: 14, color: COLORS.ink, lineHeight: 1.6}}>
				{induction.top.map((t, i) => <div key={t.head} style={{opacity: smooth(local * 2 - i * 0.3)}}>head {t.head}: <span style={{color: accent}}>{t.score.toFixed(2)}</span></div>)}
			</div>
		</div>
	);
};

/** Forward pass (cyan) then the chain rule flowing back (magenta). */
export const Backprop: React.FC<BodyProps> = ({local, w, h}) => {
	const nodes = [{id: 'x', label: 'x', x: 0, y: 0.5}, {id: 'h', label: 'h = σ(W₁x)', x: 0.33, y: 0.5}, {id: 'y', label: 'ŷ = W₂h', x: 0.66, y: 0.5}, {id: 'L', label: 'L(ŷ, y)', x: 1, y: 0.5}];
	const fwd = smooth(local / 1.2), bwd = smooth((local - 1.4) / 1.4); // forward, then backward
	return (
		<Graph w={w} h={h} fontSize={14} nodes={nodes.map((n) => ({...n, color: COLORS.cyan}))} reveal={1}
			edges={[...['x', 'h', 'y'].map((s, i) => ({s, t: ['h', 'y', 'L'][i], color: COLORS.cyan, w: fwd, bend: 0.25})),
				...(bwd > 0 ? ['L', 'y', 'h'].map((s, i) => ({s, t: ['y', 'h', 'x'][i], color: COLORS.magenta, w: bwd, bend: 0.25})) : [])]} />
	);
};
