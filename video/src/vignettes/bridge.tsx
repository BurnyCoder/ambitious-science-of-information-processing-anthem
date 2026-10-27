/**
 * Bridge cards with drawings (the formula cards of the bridge use the generic card).
 * Local: mp (live Marchenko–Pastur density + released WeightWatcher heavy-tail exponents per GPT-2 small layer),
 * category (a commutative square), pearl (the three rungs of the ladder of causation), neuronIcon / chip /
 * hydrogen (carbon, silicon, and the hydrogen spin-flip symbol of the Pioneer plaque).
 * Global: registered in ./index.ts. Sources: Marchenko & Pastur 1967; Martin & Mahoney 2021 (ww-trends-2020 CSV);
 * thresholds from the WeightWatcher README (https://github.com/CalculatedContent/WeightWatcher); Gavranović et al. 2024; Pearl & Mackenzie 2018; Azevedo et al. 2009; NVIDIA H100 whitepaper; Sagan et al. 1972.
 */
import React from 'react'; // JSX
import {random} from 'remotion'; // seeded chip pattern
import {COLORS, FONTS, smooth} from '../lib/theme'; // look
import {marchenkoPastur} from '../lib/mathviz'; // live math
import {Plot, type BodyProps} from './primitives'; // building blocks
import ww from '../../public/vignettes/ww.json'; // [layer id, alpha]

/** The random-matrix bulk (live) next to the measured heavy-tail exponent α of each GPT-2 small layer. */
export const Mp: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const q = 0.5, xs = Array.from({length: 160}, (_, i) => 0.02 + i * 0.019); // aspect ratio, eigenvalue grid
	const half = w * 0.48;
	const amax = Math.max(...ww.map(([, a]) => a));
	return (
		<div style={{position: 'absolute', inset: 0}}>
			<div style={{position: 'absolute', width: half, height: h}}>
				<Plot w={half} h={h} x={{domain: [0, 3.1], label: 'eigenvalue'}} y={{domain: [0, 0.9]}} draw={smooth(local / 1.5)}
					series={[{pts: xs.map((x) => [x, marchenkoPastur(x, q)] as [number, number]), color: accent}]} />
			</div>
			<svg width={w - half - 8} height={h} style={{position: 'absolute', left: half + 8}}>
				{ww.map(([, a], i) => <rect key={i} x={(i / ww.length) * (w - half - 8)} y={(h - 20) * (1 - a / amax)} width={(w - half - 8) / ww.length} height={(h - 20) * (a / amax)}
					fill={a < 2 ? COLORS.magenta : a <= 8 ? COLORS.lime : COLORS.violet} opacity={smooth(local * 2 - (i / ww.length) * 2)} />)}
				<text x={0} y={h - 4} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={12}>{"α per layer: <2 over-trained · >8 random-like"}</text>
			</svg>
		</div>
	);
};

/** A commutative square: going right-then-down equals down-then-right. */
export const Category: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const p = [[0.18, 0.2, 'A'], [0.82, 0.2, 'B'], [0.18, 0.85, 'C'], [0.82, 0.85, 'D']] as const;
	const arrows: [number, number, string][] = [[0, 1, 'f'], [0, 2, 'g'], [1, 3, 'h'], [2, 3, 'k']];
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			<defs><marker id="cat" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill={accent} /></marker></defs>
			{arrows.map(([a, b, l], i) => { const on = smooth(local * 2 - i * 0.4); const [x1, y1] = [p[a][0] * w, p[a][1] * h], [x2, y2] = [p[b][0] * w, p[b][1] * h];
				return <g key={l} opacity={on}><line x1={x1 + (x2 - x1) * 0.15} y1={y1 + (y2 - y1) * 0.15} x2={x1 + (x2 - x1) * 0.85} y2={y1 + (y2 - y1) * 0.85} stroke={accent} strokeWidth={2.5} markerEnd="url(#cat)" />
					<text x={(x1 + x2) / 2 + (a === 0 && b === 2 ? -16 : 8)} y={(y1 + y2) / 2 - 6} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={16}>{l}</text></g>; })}
			{p.map(([x, y, l]) => <text key={l} x={x * w} y={y * h + 7} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={22} textAnchor="middle">{l}</text>)}
			<text x={w / 2} y={h * 0.55} fill={COLORS.lime} fontFamily={FONTS.mono} fontSize={16} textAnchor="middle" opacity={smooth(local - 2)}>h ∘ f = k ∘ g</text>
		</svg>
	);
};

/** Pearl's ladder: seeing, doing, imagining, climbed rung by rung. */
export const Pearl: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const rungs = [['1 association', 'P(y | x)'], ['2 intervention', 'P(y | do(x))'], ['3 counterfactual', 'P(y_x | x′, y′)']];
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			<line x1={20} y1={4} x2={20} y2={h - 4} stroke={COLORS.dim} strokeWidth={4} /><line x1={70} y1={4} x2={70} y2={h - 4} stroke={COLORS.dim} strokeWidth={4} />
			{rungs.map(([name, f], i) => { const y = h - ((i + 0.6) / rungs.length) * h; const on = smooth(local * 1.5 - i * 0.6);
				return <g key={name} opacity={0.3 + 0.7 * on}><line x1={20} y1={y} x2={70} y2={y} stroke={accent} strokeWidth={5} />
					<text x={86} y={y - 4} fill={COLORS.ink} fontFamily={FONTS.body} fontSize={15}>{name}</text>
					<text x={86} y={y + 16} fill={accent} fontFamily={FONTS.mono} fontSize={15}>{f}</text></g>; })}
		</svg>
	);
};

/** A pyramidal neuron: soma, dendrites, axon (a carbon information processor). */
export const NeuronIcon: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const cx = w * 0.3, cy = h * 0.55, grow = smooth(local / 1.5);
	const branch = (a: number, len: number, d: number, key: string): React.ReactNode[] => {
		if (d === 0) return [];
		const x2 = Math.cos(a) * len * grow, y2 = Math.sin(a) * len * grow;
		return [<line key={key} x1={0} y1={0} x2={x2} y2={y2} stroke={accent} strokeWidth={d * 1.2} />,
			<g key={key + 'g'} transform={`translate(${x2} ${y2})`}>{branch(a - 0.45, len * 0.65, d - 1, key + 'l')}{branch(a + 0.45, len * 0.65, d - 1, key + 'r')}</g>];
	};
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			<g transform={`translate(${cx} ${cy})`}>
				{[-1.2, -1.9, -2.6, -0.5].map((a, i) => <g key={i}>{branch(a, h * 0.22, 4, `d${i}`)}</g>)}
				<line x1={0} y1={0} x2={w * 0.55 * grow} y2={h * 0.25 * grow} stroke={COLORS.magenta} strokeWidth={3} />
				<polygon points="-14,10 14,10 0,-18" fill={accent} />
			</g>
			<text x={w * 0.62} y={h * 0.3} fill={COLORS.ink} fontFamily={FONTS.display} fontSize={34}>~86 B</text>
			<text x={w * 0.62} y={h * 0.3 + 22} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={13}>neurons per human brain</text>
		</svg>
	);
};

/** A die with blinking blocks (a silicon information processor). */
export const Chip: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const n = 14, s = Math.min(w * 0.5, h) / n;
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			{Array.from({length: n * n}, (_, i) => { const on = random(`die${i}${Math.floor(local * 6)}`) > 0.6;
				return <rect key={i} x={(i % n) * s} y={Math.floor(i / n) * s} width={s - 1.5} height={s - 1.5} fill={on ? accent : '#1a2040'} />; })}
			<text x={n * s + 16} y={h * 0.4} fill={COLORS.ink} fontFamily={FONTS.display} fontSize={34}>80 B</text>
			<text x={n * s + 16} y={h * 0.4 + 22} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={13}>transistors per H100 die</text>
		</svg>
	);
};

/** The hydrogen hyperfine transition as drawn on the Pioneer plaque: two atoms, spins parallel then antiparallel. */
export const Hydrogen: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const r = Math.min(h * 0.22, w * 0.1), y = h * 0.45, flip = local % 2 > 1; // spin-flip toggles
	const atom = (x: number, up: boolean) => (
		<g transform={`translate(${x} ${y})`}>
			<circle r={r} fill="none" stroke={COLORS.ink} strokeWidth={2} />
			<line x1={0} y1={-r - 14} x2={0} y2={-r - 2} stroke={accent} strokeWidth={3} />
			<line x1={-r * 0.4} y1={up ? -r * 0.5 : r * 0.5} x2={r * 0.4} y2={up ? -r * 0.5 : r * 0.5} stroke={COLORS.ink} strokeWidth={2} />
		</g>
	);
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			{atom(w * 0.15, true)}{atom(w * 0.4, !flip)}
			<line x1={w * 0.15} y1={y + r + 16} x2={w * 0.4} y2={y + r + 16} stroke={COLORS.ink} />
			<text x={w * 0.275} y={y + r + 34} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={14} textAnchor="middle">|</text>
			<text x={w * 0.55} y={h * 0.38} fill={COLORS.ink} fontFamily={FONTS.display} fontSize={28}>1420.405 MHz</text>
			<text x={w * 0.55} y={h * 0.38 + 24} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={13}>λ ≈ 21 cm, t ≈ 0.7 ns</text>
		</svg>
	);
};
