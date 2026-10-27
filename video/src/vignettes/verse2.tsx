/**
 * Verse 2 cards: the ladder of abstraction, rung by rung, and the encyclopedia.
 * Local: neuronFeature (Neuronpedia top contexts of GPT-2 small L7 latent 4733), dayCircle (weekday-labelled
 * latents at their weekday angles, chords = released decoder cosines), paramDecomp (schematic rank-1 split),
 * grokClock (Fourier spectrum of the released grokking run over training + the rotation algorithm), othello
 * (Nanda et al. Table 1 probe accuracy), refusal (Arditi et al. released refusal scores), shoggoth (schematic),
 * encyclopedia (list), rome (schematic causal trace).
 * Global: registered in ./index.ts. Data from ../../public/vignettes/ (scripts/vignette_data.py).
 */
import React from 'react'; // JSX
import {random} from 'remotion'; // seeded schematic values
import {COLORS, FONTS, smooth} from '../lib/theme'; // look
import {Bars, Heatmap, type BodyProps} from './primitives'; // building blocks
import days from '../../public/vignettes/days.json'; // Neuronpedia day-of-week latents
import grok from '../../public/vignettes/grokking.json'; // released grokking run
import refusal from '../../public/vignettes/refusal.json'; // released refusal-direction evaluations

/** Where latent 4733 fires: its strongest Neuronpedia contexts, peak token highlighted. */
export const NeuronFeature: React.FC<BodyProps> = ({local, w, accent}) => {
	const f = days.find((d) => d.index === 4733)!;
	return (
		<div style={{position: 'absolute', inset: 0, fontFamily: FONTS.mono, fontSize: 14, color: COLORS.ink, width: w}}>
			<div style={{color: accent, marginBottom: 6}}>latent 4733: "{f.label}"</div>
			{f.contexts.map((c, i) => (
				<div key={i} style={{opacity: smooth(local * 2 - i * 0.6), whiteSpace: 'nowrap', overflow: 'hidden', marginBottom: 4}}>
					{c.tokens.map((tok, k) => {
						const v = c.values[k] / Math.max(...c.values, 1e-9); // 0..1 activation
						return <span key={k} style={{background: `rgba(157,255,92,${0.75 * Math.max(0, v)})`, color: k === c.peak ? COLORS.bg : COLORS.ink, borderRadius: 3}}>{tok.replace(/\n|Ċ/g, '⏎').replace(/Ġ/g, ' ')}</span>;
					})}
				</div>
			))}
		</div>
	);
};

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // circle positions
const dayOf = (label: string) => WEEK.findIndex((d) => label.toLowerCase().includes({Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday', Thu: 'thursday', Fri: 'friday', Sat: 'saturday', Sun: 'sunday'}[d]!)); // -1 if unlabelled

/** Weekday-labelled latents at their weekday angle, other day latents in the middle, chords = decoder cosine. */
export const DayCircle: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const R = Math.min(w, h) * 0.4, cx = w / 2, cy = h / 2;
	const pos = Object.fromEntries(days.map((d, i) => {
		const k = dayOf(d.label);
		const a = (k / 7) * 2 * Math.PI - Math.PI / 2; // weekday angle, Monday at the top
		return [d.index, k >= 0 ? {x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), k} : {x: cx + (i % 2 ? 22 : -22), y: cy + ((i % 3) - 1) * 26, k}];
	}));
	const chords = days.flatMap((d) => Object.entries(d.cos).map(([j, c]) => ({a: d.index, b: Number(j), c}))).filter((e) => e.a < e.b && pos[e.b]);
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			<circle cx={cx} cy={cy} r={R} fill="none" stroke={COLORS.dim} strokeDasharray="4 6" />
			{WEEK.map((d, k) => { const a = (k / 7) * 2 * Math.PI - Math.PI / 2; const has = days.some((x) => dayOf(x.label) === k);
				return <text key={d} x={cx + (R + 18) * Math.cos(a)} y={cy + (R + 18) * Math.sin(a) + 5} fill={has ? COLORS.ink : COLORS.dim} fontFamily={FONTS.mono} fontSize={13} textAnchor="middle">{has ? d : `${d}?`}</text>; })}
			{chords.map((e, i) => <line key={i} x1={pos[e.a].x} y1={pos[e.a].y} x2={pos[e.b].x} y2={pos[e.b].y} stroke={accent} strokeWidth={1 + 4 * (e.c - 0.55) / 0.25} opacity={0.25 + 0.6 * smooth(local - i * 0.1)} />)}
			{days.map((d) => <circle key={d.index} cx={pos[d.index].x} cy={pos[d.index].y} r={pos[d.index].k >= 0 ? 7 : 4} fill={pos[d.index].k >= 0 ? accent : COLORS.violet} />)}
		</svg>
	);
};

/** A weight matrix as a sum of rank-1 pieces, each pulled out in turn. */
export const ParamDecomp: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const n = 8, K = 3; // matrix size, components
	const u = Array.from({length: K}, (_, c) => Array.from({length: n}, (_, i) => Math.round(Math.sin(i * (c + 1.3) + c) * 10) / 10)); // seeded-looking but fixed vectors
	const comp = (c: number) => u[c].map((a) => u[(c + 1) % K].map((b) => a * b)); // u_c ⊗ u_{c+1}
	const W = comp(0).map((row, i) => row.map((v, j) => v + comp(1)[i][j] + comp(2)[i][j]));
	const s = Math.min(w / (4 * 1.25), h * 0.9); // panel size
	const split = smooth((local - 0.8) / 1.5);
	return (
		<div style={{position: 'absolute', inset: 0}}>
			{[W, comp(0), comp(1), comp(2)].map((z, i) => (
				<div key={i} style={{position: 'absolute', left: i * s * 1.25, top: 6, width: s, height: s, opacity: i === 0 ? 1 : split}}>
					<Heatmap w={s} h={s} z={z} color={i === 0 ? accent : [COLORS.magenta, COLORS.lime, COLORS.amber][i - 1]} lo={-2} hi={2} />
					<div style={{position: 'absolute', top: s + 2, width: s, textAlign: 'center', fontFamily: FONTS.mono, fontSize: 14, color: COLORS.ink}}>{i === 0 ? 'W =' : `P${i}${i < 3 ? ' +' : ''}`}</div>
				</div>
			))}
		</div>
	);
};

/** The released run's embedding spectrum sharpening over training, and the rotation a + b → c it implements. */
export const GrokClock: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const i = Math.min(grok.spectra.length - 1, Math.floor((local / 3.5) * grok.spectra.length)); // epoch frame
	const spec = grok.spectra[i], max = Math.max(...grok.spectra[grok.spectra.length - 1]);
	const bw = (w * 0.62) / spec.length, bh = h - 34;
	const k = 14, a = 23, b = 61, angle = (v: number) => (2 * Math.PI * k * v) / 113 - Math.PI / 2; // one key frequency
	const R = Math.min(w * 0.17, h * 0.4), cx = w * 0.82, cy = h * 0.45;
	const turn = smooth((local - 1) / 2); // b's rotation added on top of a's
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			{spec.map((v, j) => <rect key={j} x={j * bw} y={bh - (bh * v) / max} width={bw - 1} height={(bh * v) / max} fill={grok.keyFreqs.includes(j + 1) ? COLORS.lime : accent} opacity={0.85} />)}
			<text x={0} y={h - 18} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={12}>frequency k = 1 … 56 · epoch {grok.spectraEpochs[i].toLocaleString('en-US')}</text>
			<text x={0} y={h - 2} fill={COLORS.lime} fontFamily={FONTS.mono} fontSize={12}>key k: {grok.keyFreqs.join(', ')}</text>
			<circle cx={cx} cy={cy} r={R} fill="none" stroke={COLORS.dim} />
			{[[a, COLORS.cyan, 1], [a + b * turn, COLORS.lime, turn]].map(([v, c, o], q) => (
				<line key={q} x1={cx} y1={cy} x2={cx + R * Math.cos(angle(v as number))} y2={cy + R * Math.sin(angle(v as number))} stroke={c as string} strokeWidth={3} opacity={o as number} />))}
			<text x={cx} y={cy + R + 18} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={12} textAnchor="middle">{a} + {b} ≡ {(a + b) % 113} (mod 113)</text>
		</svg>
	);
};

/** Linear-probe accuracy for mine/theirs by layer (Nanda, Lee & Wattenberg 2023, Table 1) beside a board. */
export const Othello: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const acc = [90.9, 94.8, 97.2, 98.3, 99.0, 99.4, 99.6, 99.5]; // layers 0..7
	const s = Math.min(h - 4, w * 0.4) / 8; // board cell
	return (
		<div style={{position: 'absolute', inset: 0}}>
			<svg width={8 * s} height={8 * s} style={{position: 'absolute', left: 0, top: 2}}>
				{Array.from({length: 64}, (_, i) => { const r = random(`oth${i}`); const piece = r < 0.3 ? COLORS.ink : r < 0.6 ? '#111' : null;
					return <g key={i}><rect x={(i % 8) * s} y={Math.floor(i / 8) * s} width={s - 1} height={s - 1} fill="#0f6b3c" />
						{piece ? <circle cx={(i % 8) * s + s / 2} cy={Math.floor(i / 8) * s + s / 2} r={s * 0.38} fill={piece} stroke={COLORS.dim} opacity={smooth(local * 3 - i / 20)} /> : null}</g>; })}
			</svg>
			<div style={{position: 'absolute', left: 8 * s + 14, top: 0, width: w - 8 * s - 14, height: h}}>
				<Bars w={w - 8 * s - 14} h={h} labelW={52} max={100} reveal={smooth(local / 2)}
					items={acc.map((v, i) => ({label: `L${i}`, value: v, text: `${v}%`, color: accent}))} />
			</div>
		</div>
	);
};

/** Released refusal scores for every (token position, layer) candidate direction; ring = the chosen one. */
export const Refusal: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const z = refusal.refusalScore; // positions x layers
	const r = refusal.positions.indexOf(refusal.chosen.pos), c = refusal.layers.indexOf(refusal.chosen.layer);
	const jb = refusal.jailbreakbench;
	return (
		<div style={{position: 'absolute', inset: 0}}>
			<Heatmap w={w} h={h * 0.55} z={z.map((row) => row.map((v) => -v))} color={accent} reveal={smooth(local / 1.4)} rings={[[r, c]]} xLabel="layer 0 … 31" yLabel="pos" />
			<div style={{position: 'absolute', top: h * 0.6, fontFamily: FONTS.mono, fontSize: 13, color: COLORS.ink, lineHeight: 1.5, opacity: smooth(local - 1)}}>
				JailbreakBench, harmful requests answered without a refusal phrase:<br />
				<span style={{color: COLORS.dim}}>baseline</span> {Math.round(jb.baseline.substring_matching_success_rate * 100)}% → <span style={{color: accent}}>direction ablated {Math.round(jb.ablation.substring_matching_success_rate * 100)}%</span>
			</div>
		</div>
	);
};

/** The shoggoth meme: a many-eyed thing behind a smiling mask, with persona-vector dials. */
export const Shoggoth: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const cx = w * 0.32, cy = h * 0.5, R = Math.min(w * 0.28, h * 0.45);
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			{Array.from({length: 9}, (_, i) => { const a = (i / 9) * 2 * Math.PI, wob = Math.sin(local * 2 + i) * 10;
				return <path key={i} d={`M ${cx} ${cy} Q ${cx + Math.cos(a + 0.4) * R * 0.9 + wob} ${cy + Math.sin(a + 0.4) * R * 0.9} ${cx + Math.cos(a) * R * 1.15} ${cy + Math.sin(a) * R * 1.15}`} stroke="#3d7a4f" strokeWidth={10} fill="none" strokeLinecap="round" />; })}
			<circle cx={cx} cy={cy} r={R * 0.75} fill="#2c5a3a" />
			{Array.from({length: 7}, (_, i) => <circle key={i} cx={cx + Math.cos(i * 2.3) * R * 0.55} cy={cy + Math.sin(i * 2.3) * R * 0.55} r={4 + (i % 3) * 2} fill="#ffe66b" />)}
			<circle cx={cx + R * 0.15} cy={cy} r={R * 0.38} fill="#ffd34d" stroke={COLORS.bg} strokeWidth={2} />
			<circle cx={cx + R * 0.02} cy={cy - R * 0.1} r={3} fill={COLORS.bg} /><circle cx={cx + R * 0.28} cy={cy - R * 0.1} r={3} fill={COLORS.bg} />
			<path d={`M ${cx} ${cy + R * 0.1} Q ${cx + R * 0.15} ${cy + R * 0.25} ${cx + R * 0.3} ${cy + R * 0.1}`} stroke={COLORS.bg} strokeWidth={3} fill="none" />
			{['sycophancy', 'evil', 'hallucination'].map((trait, i) => { const v = 0.5 + 0.45 * Math.sin(local * 1.5 + i * 2);
				return <g key={trait} transform={`translate(${w * 0.66} ${20 + i * (h / 3.2)})`}>
					<text x={0} y={0} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={13}>{trait}</text>
					<rect x={0} y={8} width={w * 0.32} height={8} rx={4} fill="#20253f" /><rect x={0} y={8} width={w * 0.32 * v} height={8} rx={4} fill={accent} />
				</g>; })}
		</svg>
	);
};

/** Mechanisms already written up, with years: the encyclopedia's first entries. */
export const Encyclopedia: React.FC<BodyProps> = ({local, h, accent}) => {
	const entries = [['2020', 'curve detectors'], ['2022', 'induction heads'], ['2022', 'IOI circuit'], ['2023', 'modular addition by rotation'], ['2023', 'Othello world model'], ['2024', 'refusal direction'], ['2024', 'Golden Gate feature'], ['2025', 'rhyme planning']];
	return (
		<div style={{position: 'absolute', inset: 0, fontFamily: FONTS.mono, fontSize: Math.min(16, h / 9.5), color: COLORS.ink, lineHeight: 1.35}}>
			{entries.map(([y, e], i) => <div key={e} style={{opacity: smooth(local * 3 - i * 0.5)}}><span style={{color: accent}}>§{i + 1}</span> {e} <span style={{color: COLORS.dim}}>{y}</span> <span style={{color: COLORS.lime}}>✓</span></div>)}
		</div>
	);
};

/** Causal trace: restoring hidden states at (token, layer) restores "Seattle"; mid-layer MLPs at the last subject token light up. */
export const Rome: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const toks = ['The', 'Space', 'Need*', 'le*', 'is', 'in', 'downtown']; // * = subject tokens (corrupted)
	const L = 12;
	const z = toks.map((_, t) => Array.from({length: L}, (_, l) => (t === 3 ? Math.exp(-((l - 4) ** 2) / 6) : t === 6 ? Math.max(0, (l - 6) / 6) : 0.05))); // schematic of Meng et al. Fig. 1
	return (
		<div style={{position: 'absolute', inset: 0}}>
			<div style={{position: 'absolute', left: 78, top: 0}}><Heatmap w={w - 80} h={h - 16} z={z} color={accent} reveal={smooth(local / 1.5)} xLabel="layer →" /></div>
			{toks.map((t, i) => <div key={t} style={{position: 'absolute', left: 0, top: ((i + 0.3) * (h - 16)) / toks.length, fontFamily: FONTS.mono, fontSize: 12, color: t.endsWith('*') ? COLORS.magenta : COLORS.ink}}>{t}</div>)}
		</div>
	);
};
