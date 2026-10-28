/**
 * Chorus cards: "Every cause behind every behavior, mapped out by our hand! ... open the black box wide".
 * Local: attribution graphs from Anthropic's released graph JSON collapsed to the authors' supernodes (Dallas,
 * rabbit, 36+59), Gemma-2-2B's top outputs on the open Neuronpedia graph, the IOI circuit (published head
 * classes), activation patching (schematic), SAE features (published ids) and the Golden Gate clamp (schematic).
 * Global: registered in ./index.ts. Sources: Lindsey et al. 2025; Neuronpedia gemma-fact-dallas-austin;
 * Wang et al. 2022 Fig. 2; Bricken et al. 2023; Templeton et al. 2024; Heimersheim & Nanda 2024.
 */
import React from 'react'; // JSX
import {random} from 'remotion'; // seeded schematic values
import {COLORS, FONTS, smooth} from '../lib/theme'; // look
import {Bars, Graph, Heatmap, type BodyProps, type GNode} from './primitives'; // building blocks
import graphs from '../../public/vignettes/graphs.json'; // supernode graphs + Gemma outputs

type SG = (typeof graphs)['dallas']; // one supernode graph
const SHORT: Record<string, string> = {'say a word that contains an "ab" sound': 'say "ab"', 'say a word with a "b"  in it': 'say "b"', 'say "__it" (phonetically)': 'say "…it"',
	'newline after eet/it/et sound': 'after "-it" ⏎', 'say word with short "a" sound': 'short "a"', 'food/hunger -> say animal': 'hunger → animal', 'starving / hungry': 'hungry',
	'wide magnitude lookup': 'wide lookup', 'narrow magnitude lookup': 'narrow lookup'}; // the authors' long supernode names, abbreviated
/** Local: compact label for a supernode or output ('output: "Austin" (p=0.984)' -> '→ Austin'). Global: graph cards and the chorus circuits. */
export const shortLabel = (s: string) => SHORT[s] ?? s.replace(/^output: "(.*)" \(p=.*\)$/, '→ $1');

/** Supernode graph: x = token position (spread within a position), y = layer (output at the top). */
const AttributionGraph: React.FC<BodyProps & {g: SG; out: string}> = ({g, out, local, w, h, accent}) => {
	const ctxs = [...new Set(g.nodes.map((n) => n.ctx))].sort((a, b) => a - b); // token positions = horizontal lanes
	const order = [...g.nodes].sort((a, b) => a.layer - b.layer || a.ctx - b.ctx); // early layers left, output right
	const nodes: GNode[] = order.map((n, k) => ({id: n.label, label: shortLabel(n.label), x: k / Math.max(1, order.length - 1),
		y: ctxs.length > 1 ? 0.12 + (0.76 * ctxs.indexOf(n.ctx)) / (ctxs.length - 1) : 0.5, below: k % 2 === 1, color: n.output ? COLORS.lime : accent, r: n.output ? 8 : 6}));
	const edges = g.edges.slice(0, 11).map((e) => ({s: e.source, t: e.target, w: e.weight})); // strongest links
	return (
		<div style={{position: 'absolute', inset: 0}}>
			<Graph w={w} h={h - 18} nodes={nodes} edges={edges} reveal={smooth(local / 2.4)} fontSize={11} />
			<div style={{position: 'absolute', bottom: 0, left: 0, right: 0, fontFamily: FONTS.mono, fontSize: 12, color: COLORS.dim, whiteSpace: 'nowrap', overflow: 'hidden'}}>
				{g.tokens.slice(1).join('').replace(/\n/g, ' ⏎ ').replace(/^↑/, '')} <span style={{color: COLORS.lime}}>{out}</span>
			</div>
		</div>
	);
};

/** Local: the model's completion of each released prompt (from the paper). Global: these cards and the chorus token row. */
export const OUTPUTS = {dallas: 'Austin', rabbit: 'rabbit', calc: '95'} as const;
export const GraphDallas: React.FC<BodyProps> = (p) => <AttributionGraph {...p} g={graphs.dallas} out={OUTPUTS.dallas} />;
export const GraphRabbit: React.FC<BodyProps> = (p) => <AttributionGraph {...p} g={graphs.rabbit} out={OUTPUTS.rabbit} />;
export const GraphCalc: React.FC<BodyProps> = (p) => <AttributionGraph {...p} g={graphs.calc} out={OUTPUTS.calc} />;

/** What Gemma-2-2B says next on the same prompt (output probabilities stored in the open graph). */
export const GraphGemma: React.FC<BodyProps> = ({local, w, h, accent}) => (
	<Bars w={w} h={h} labelW={90} reveal={smooth(local / 1.5)} max={0.5}
		items={graphs.gemma.outputs.slice(0, 6).map((o, i) => ({label: `"${o.token.trim() || '␠'}"`, value: o.p, text: o.p.toFixed(3), color: i ? accent : COLORS.lime}))} />
);

/** The IOI circuit in GPT-2 small: head classes and how information flows to the answer. */
export const Ioi: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const n = (id: string, label: string, x: number, y: number, color = accent): GNode => ({id, label, x, y, color});
	return (
		<Graph w={w} h={h} fontSize={11} reveal={smooth(local / 2.5)}
			nodes={[n('prev', 'previous token\n2.2 4.11', 0.04, 0.85, COLORS.violet), n('dup', 'duplicate token\n0.1 3.0', 0.25, 0.35, COLORS.violet),
				n('ind', 'induction\n5.5 6.9', 0.32, 0.85, COLORS.violet), n('sinh', 'S-inhibition\n7.3 7.9 8.6 8.10', 0.58, 0.55),
				n('nm', 'name movers\n9.6 9.9 10.0', 0.82, 0.35, COLORS.magenta), n('out', '"Mary"', 0.98, 0.9, COLORS.lime)]}
			edges={[{s: 'prev', t: 'ind'}, {s: 'ind', t: 'sinh'}, {s: 'dup', t: 'sinh'}, {s: 'sinh', t: 'nm'}, {s: 'nm', t: 'out'}]} />
	);
};

/** Patch clean activations into a corrupted run, one (layer, token) site at a time. */
export const Patching: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const L = 8, T = 6; // layers x tokens (schematic)
	const z = Array.from({length: L}, (_, l) => Array.from({length: T}, (_, t) => (t === 2 && l < 5 ? 0.9 - 0.08 * l : t === 5 && l > 3 ? 0.4 + 0.1 * (l - 4) : 0.05 * random(`pt${l}${t}`)))); // effect sizes
	const site = Math.floor(local * 4) % (L * T); // cell being patched
	return (
		<div style={{position: 'absolute', inset: 0}}>
			<Heatmap w={w * 0.62} h={h} z={z} color={accent} reveal={smooth(local / 1.5)} rings={[[Math.floor(site / T), site % T]]} xLabel="token" yLabel="layer" />
			<div style={{position: 'absolute', left: w * 0.66, top: 6, fontFamily: FONTS.mono, fontSize: 13, color: COLORS.ink, lineHeight: 1.7}}>
				<div>clean → <span style={{color: COLORS.lime}}>Mary</span></div><div>corrupt → <span style={{color: COLORS.magenta}}>John</span></div>
				<div>patch site → effect</div><div style={{color: accent}}>Δlogit = {z[Math.floor(site / T)][site % T].toFixed(2)}</div>
			</div>
		</div>
	);
};

/** Dictionary features with their published ids, each lighting up in turn. */
export const Sae: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const feats = [['A/1/3450', 'Arabic script', 'العربية'], ['A/1/2937', 'DNA', 'ACGTTGCA'], ['A/1/2357', 'base64', 'aGVsbG8='], ['A/1/416', 'Hebrew', 'עברית']];
	const on = Math.floor(local * 1.5) % feats.length;
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			{feats.map(([id, name, sample], i) => {
				const y = (i + 0.5) * (h / feats.length);
				return (
					<g key={id} opacity={smooth(local * 3 - i)}>
						<rect x={0} y={y - h / 10} width={w} height={h / 5.5} rx={6} fill={accent} opacity={i === on ? 0.3 : 0.08} />
						<text x={8} y={y + 5} fill={accent} fontFamily={FONTS.mono} fontSize={14}>{id}</text>
						<text x={w * 0.3} y={y + 5} fill={COLORS.ink} fontFamily={FONTS.body} fontSize={15}>{name}</text>
						<text x={w - 8} y={y + 5} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={14} textAnchor="end">{sample}</text>
					</g>
				);
			})}
		</svg>
	);
};

/** A bridge drawing and the clamp dial on one feature. */
export const GoldenGate: React.FC<BodyProps> = ({local, w, h}) => {
	const clamp = smooth(local / 2); // schematic dial: the feature turned up
	const tw = w * 0.58, base = h * 0.75; // bridge panel
	const cable = (x0: number, x1: number) => `M ${x0} ${base * 0.35} Q ${(x0 + x1) / 2} ${base * 0.9} ${x1} ${base * 0.35}`;
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			<line x1={0} y1={base} x2={tw} y2={base} stroke="#ff6a3d" strokeWidth={5} />
			{[tw * 0.28, tw * 0.72].map((x) => <rect key={x} x={x - 5} y={base * 0.25} width={10} height={base * 0.85} fill="#ff6a3d" />)}
			{[cable(0, tw * 0.28), cable(tw * 0.28, tw * 0.72), cable(tw * 0.72, tw)].map((d) => <path key={d} d={d} stroke="#ff6a3d" strokeWidth={3} fill="none" />)}
			<text x={tw + 12} y={22} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={13}>feature 34M/31164353</text>
			<rect x={tw + 12} y={36} width={w - tw - 20} height={12} rx={6} fill="#20253f" />
			<rect x={tw + 12} y={36} width={(w - tw - 20) * clamp} height={12} rx={6} fill="#ff6a3d" />
			<text x={tw + 12} y={70} fill="#ff6a3d" fontFamily={FONTS.mono} fontSize={13}>clamped high</text>
			<text x={tw + 12} y={96} fill={COLORS.ink} fontFamily={FONTS.body} fontSize={13} opacity={smooth(local - 1.5)}>→ it talks as the bridge</text>
		</svg>
	);
};
