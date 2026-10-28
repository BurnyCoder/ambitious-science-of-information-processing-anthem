/**
 * Intro, final-chorus and outro cards: tokens, ideal solving, the shortest program, interventions, the timeline.
 * Local: tokens (real GPT-2 BPE ids of the title), checklist (the project's definition of full understanding),
 * arc (an original ARC-style puzzle), kProgram (a 280-bit string vs the short program that prints it), dag
 * (do-intervention cuts the arrows into a node), actadd (ActAdd's Love − Hate example, Turner et al. 2023 Table 1),
 * milestones (dated landmarks from 1943 to 2026).
 * Global: registered in ./index.ts. Sources: GPT-2 tokenizer (openai-community/gpt2); Chollet 2019; Kolmogorov
 * 1965; Pearl 2009; Turner et al. 2023 (arXiv:2308.10248); the papers named in each milestone.
 */
import React from 'react'; // JSX
import {random} from 'remotion'; // seeded bits
import {COLORS, FONTS, smooth} from '../lib/theme'; // look
import {Graph, type BodyProps} from './primitives'; // building blocks
import tokens from '../../public/vignettes/tokens.json'; // real GPT-2 token ids

/** The title and the closing line as GPT-2 sees them: byte-pair tokens and their vocabulary ids, sized to fill the body. */
export const Tokens: React.FC<BodyProps> = ({local, w, h, accent}) => (
	<div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', width: w, height: h}}>
		{tokens.slice(0, 2).map((t, r) => (
			<div key={r} style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
				{t.tokens.map((tok, i) => (
					<div key={i} style={{opacity: smooth(local * 3 - r * 2 - i * 0.4), border: `2px solid ${accent}`, borderRadius: 8, padding: '6px 10px', fontFamily: FONTS.mono, color: COLORS.ink, textAlign: 'center'}}>
						<div style={{fontSize: r ? 22 : 30}}>{tok.replace('Ġ', '␣')}</div>
						<div style={{fontSize: r ? 15 : 19, color: accent}}>{t.ids[i]}</div>
					</div>
				))}
			</div>
		))}
	</div>
);

/** Four requirements of "ideal solving", ticked off one after another. */
export const Checklist: React.FC<BodyProps> = ({local, h, accent}) => {
	const items = ['predict any behavior', 'predict any activation', 'predict any intervention', 'with the shortest theory'];
	return (
		<div style={{position: 'absolute', inset: 0, fontFamily: FONTS.body, fontSize: Math.min(20, h / 5.5), color: COLORS.ink, lineHeight: 1.45}}>
			{items.map((it, i) => <div key={it}><span style={{color: smooth(local * 1.6 - i - 0.5) > 0.5 ? COLORS.lime : COLORS.dim}}>{smooth(local * 1.6 - i - 0.5) > 0.5 ? '☑' : '☐'}</span> <span style={{color: i === 3 ? accent : COLORS.ink}}>{it}</span></div>)}
		</div>
	);
};

export const PAL = ['#0b0e24', COLORS.cyan, COLORS.magenta, COLORS.amber, COLORS.lime]; // ARC-style cell colors (also the finale's drifting cells)
/** Two input -> output examples (rule: mirror left-right), then a test grid whose answer appears. */
export const Arc: React.FC<BodyProps> = ({local, w, h}) => {
	const grids = [[[1, 0, 0], [1, 2, 0], [0, 0, 3]], [[0, 4, 0], [2, 0, 0], [2, 2, 1]], [[3, 0, 1], [0, 0, 1], [4, 4, 0]]]; // original puzzle
	const mirror = (g: number[][]) => g.map((r) => [...r].reverse());
	const s = Math.min(h / 4.2, w / 22); // cell size
	const draw = (g: number[][], x: number, key: string, o = 1) => g.flatMap((r, i) => r.map((v, j) => <rect key={`${key}${i}${j}`} x={x + j * s} y={8 + i * s} width={s - 2} height={s - 2} fill={PAL[v]} stroke="#2a3060" opacity={o} />));
	const step = 3 * s + 3 * s; // pair width
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			{grids.map((g, k) => {
				const x = k * (step + 1.6 * s);
				const out = k < 2 ? 1 : smooth((local - 2.2) / 0.5); // test answer appears last
				return <g key={k} opacity={smooth(local * 2 - k * 0.8)}>
					{draw(g, x, `i${k}`)}<text x={x + 3 * s + 2} y={8 + 1.8 * s} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={s * 0.6}>→</text>
					{k < 2 || out > 0.01 ? draw(mirror(g), x + 3.6 * s, `o${k}`, out) : <text x={x + 4.6 * s} y={8 + 2 * s} fill={COLORS.amber} fontFamily={FONTS.display} fontSize={s * 1.2}>?</text>}
				</g>;
			})}
		</svg>
	);
};

/** Local: a 20-bit period, the 280-bit string it repeats into, and the program that prints it (a short description, in
 * the sense of Kolmogorov complexity). Global: the kProgram card and the finale's bit rain. */
export const PERIOD = Array.from({length: 20}, (_, i) => (random(`b${i}`) > 0.5 ? '1' : '0')).join('');
export const BITS = PERIOD.repeat(14); // 280 bits
export const PROGRAM = `p = "${PERIOD}"
print(p * 14)`;

/** 280 bits that are a 20-bit pattern repeated 14 times, collapsing into the program that prints them. */
export const KProgram: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const k = smooth((local - 0.6) / 1.4); // compression progress
	const bits = BITS.slice(0, Math.round(280 * (1 - k))); // remaining raw bits
	return (
		<div style={{position: 'absolute', inset: 0, fontFamily: FONTS.mono, color: COLORS.ink, width: w}}>
			<div style={{fontSize: 11, color: accent, wordBreak: 'break-all', lineHeight: 1.15, height: h * 0.45, overflow: 'hidden', opacity: 0.85}}>{bits}</div>
			<div style={{fontSize: 17, opacity: k, marginTop: 4, whiteSpace: 'pre'}}>{PROGRAM}</div>
			<div style={{fontSize: 13, color: COLORS.dim, opacity: k, marginTop: 4}}>280 bits → a {PROGRAM.length}-character program</div>
		</div>
	);
};

/** A causal graph; do(circuit := c′) cuts the arrows into the circuit node and changes the behavior. */
export const Dag: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const iv = smooth((local - 1.2) / 0.4) > 0.5; // intervention applied
	const n = (id: string, x: number, y: number, color = accent) => ({id, label: id, x, y, color});
	return (
		<Graph w={w} h={h} fontSize={13} reveal={1}
			nodes={[n('data', 0.05, 0.15), n('hyperparams', 0.45, 0.1), n('features', 0.2, 0.75), n('circuit', 0.6, 0.75, iv ? COLORS.lime : accent), n('behavior', 0.95, 0.4, iv ? COLORS.cyan : accent)]}
			edges={[{s: 'data', t: 'features'}, {s: 'hyperparams', t: 'features'}, {s: 'features', t: 'circuit', cut: iv}, {s: 'hyperparams', t: 'circuit', cut: iv}, {s: 'circuit', t: 'behavior', color: iv ? COLORS.lime : undefined}]} />
	);
};

/** ActAdd: add the activation difference "Love" − "Hate" at layer 6 and the continuation turns. */
export const Actadd: React.FC<BodyProps> = ({local, h, accent}) => {
	const steer = smooth((local - 1) / 0.5); // steered completion appears
	return (
		<div style={{position: 'absolute', inset: 0, fontFamily: FONTS.mono, fontSize: Math.min(13.5, h / 8), color: COLORS.ink, lineHeight: 1.4}}>
			<div>h_l ← h_l + c · (h_l("Love") − h_l("Hate"))</div>
			<div style={{color: COLORS.dim}}>"I hate you because…"</div>
			<div style={{color: COLORS.magenta, opacity: 1 - 0.6 * steer}}>unsteered: …you are the most disgusting thing I have ever seen.</div>
			<div style={{color: accent, opacity: steer}}>steered: …you are so beautiful and I want to be with you forever.</div>
		</div>
	);
};

/** Dated landmarks on one line, lighting up left to right. */
const MILESTONES: [number, string][] = [[1943, 'McCulloch–Pitts neuron'], [1948, 'Shannon: information'], [1958, 'perceptron'], [1986, 'backprop'], [2012, 'AlexNet'],
	[2017, 'Transformer'], [2020, 'scaling laws'], [2022, 'induction heads'], [2024, 'Golden Gate feature'], [2025, 'attribution graphs'], [2026, 'theory of deep learning?']]; // dated landmarks
export const Milestones: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const ms = MILESTONES;
	const row = h / ms.length; // one line per landmark
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			<line x1={58} y1={row / 2} x2={58} y2={h - row / 2} stroke={COLORS.dim} strokeWidth={2} />
			{ms.map(([y, l], i) => { const on = smooth(local * 5 - i * 0.4), cy = (i + 0.5) * row;
				return <g key={l} opacity={0.25 + 0.75 * on}><text x={48} y={cy + 4} fill={accent} fontFamily={FONTS.mono} fontSize={Math.min(13, row * 0.8)} textAnchor="end">{y}</text>
					<circle cx={58} cy={cy} r={4} fill={accent} />
					<text x={70} y={cy + 4} fill={COLORS.ink} fontFamily={FONTS.body} fontSize={Math.min(14, row * 0.85)}>{l}</text></g>; })}
		</svg>
	);
};
