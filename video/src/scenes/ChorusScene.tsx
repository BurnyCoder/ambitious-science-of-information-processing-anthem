/**
 * Chorus — "We will know! We will understand!"
 * Local: a layered network graph fills the frame; on every downbeat a real circuit lights up through it: the
 * strongest path (greedy max-weight edges to the output) of an attribution graph released by Lindsey et al. 2025,
 * labelled with the authors' supernode names (chorus 1: Dallas -> Austin; chorus 2: 36+59 and the rabbit couplet),
 * while the sung word slams in at giant size (drawn by Anthem in the lower third). Along the bottom, the graph's real
 * prompt tokens light up where the circuit's supernodes sit, with dashed links up to them, and end in the model's
 * output ("→ Austin"). The second chorus swaps the palette.
 * Global: the emotional hook; "map every cause behind every behavior" = tracing circuits.
 */
import React from 'react'; // JSX
import {AbsoluteFill, random, useVideoConfig} from 'remotion'; // layer + RNG + size
import {lastIndexAtOrBefore} from '../lib/timeline'; // which downbeat we are in
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import graphs from '../../public/vignettes/graphs.json'; // supernode graphs (scripts/vignette_data.py)
import {OUTPUTS, shortLabel} from '../vignettes/chorus'; // model outputs + compact supernode labels
import type {SceneProps} from './types'; // contract

const COLS = 7; // graph layers
const ROWS = 6; // nodes per layer

/** Local: screen position of grid node i (column = layer), with seeded jitter, on the 1920x1080 frame.
 * Global: drawn here; stage/anchors.ts dives chorus cards out of these nodes. */
export const chorusNode = (i: number) => ({
	x: 140 + (Math.floor(i / ROWS) / (COLS - 1)) * (1920 - 280) + (random(`jx${i}`) - 0.5) * 60,
	y: 180 + ((i % ROWS) / (ROWS - 1)) * (1080 - 360) + (random(`jy${i}`) - 0.5) * 50, // top row clear of the HUD under the camera push
});
export const CHORUS_NODES = COLS * ROWS; // grid size

type SG = {tokens: string[]; nodes: {label: string; output: boolean; ctx: number}[]; edges: {source: string; target: string; weight: number}[]}; // supernode graph
/** Local: from each node, follow the heaviest outgoing edge until an output (max 6 hops); unique paths, strongest
 * start first. Global: the named circuits the chorus lights up, read from released data. */
const strongestPaths = (g: SG): string[][] => {
	const out = (a: string) => g.edges.filter((e) => e.source === a).sort((x, y) => y.weight - x.weight); // heaviest first
	const starts = [...g.nodes].filter((n) => !n.output).sort((a, b) => (out(b.label)[0]?.weight ?? 0) - (out(a.label)[0]?.weight ?? 0));
	const paths: string[][] = [];
	for (const s of starts) {
		const path = [s.label];
		while (path.length < 7 && !g.nodes.find((n) => n.label === path[path.length - 1])?.output) {
			const next = out(path[path.length - 1]).find((e) => !path.includes(e.target)); // no cycles
			if (!next) break;
			path.push(next.target);
		}
		const key = path.join('>');
		if (path.length > 2 && !paths.some((q) => q.join('>') === key)) paths.push(path);
	}
	return paths;
};
type Key = keyof typeof OUTPUTS; // dallas | rabbit | calc
const circuitsOf = (key: Key, n = 99) => strongestPaths(graphs[key]).slice(0, n).map((path) => ({key, path})); // paths tagged with their graph
const NAMED = [circuitsOf('dallas'), [...circuitsOf('calc', 3), ...circuitsOf('rabbit', 3)]]; // per chorus
if (NAMED.some((n) => n.length === 0)) throw new Error('graphs.json yields no circuit path; re-run scripts/vignette_data.py'); // fail at bundle time, not per frame
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7); // label -> stable row

export const ChorusScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t} = useSceneClock(section); // absolute time
	const {width, height} = useVideoConfig(); // frame size
	const [lead, alt] = section.occurrence % 2 === 1 ? [COLORS.cyan, COLORS.magenta] : [COLORS.magenta, COLORS.cyan]; // palette per repeat
	const nodes = Array.from({length: CHORUS_NODES}, (_, i) => chorusNode(i)); // node grid with seeded jitter
	const d = lastIndexAtOrBefore(tl.downbeats, t); // current bar index (global)
	const named = NAMED[(section.occurrence - 1) % NAMED.length]; // this chorus's circuits
	const pathOf = (k: number) => named[((k % named.length) + named.length) % named.length]; // bar k -> one named path
	const circuit = (k: number) => pathOf(k).path.map((label, i, all) => Math.round((i * (COLS - 1)) / (all.length - 1)) * ROWS + (hash(label) % ROWS)); // node per hop
	const age = d >= 0 ? t - tl.downbeats[d] : 99; // seconds since this bar began
	const paths = [0, 1, 2].map((back) => ({nodes: circuit(d - back), alpha: Math.max(0, 1 - (age + back * 1.9) / 3.5)})); // current + fading previous circuits
	return (
		<AbsoluteFill>
			<svg width={width} height={height} style={{position: 'absolute'}}>
				{nodes.map((a, i) => (Math.floor(i / ROWS) < COLS - 1 ? nodes.slice((Math.floor(i / ROWS) + 1) * ROWS, (Math.floor(i / ROWS) + 2) * ROWS).map((b, j) => (
					<line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={COLORS.ink} strokeOpacity={0.05} /> // dense, dim weights
				)) : null))}
				{paths.map((p, k) => p.nodes.slice(1).map((n, c) => {
					const a = nodes[p.nodes[c]]; // previous node on the circuit
					const b = nodes[n]; // next node
					const grow = Math.min(1, Math.max(0, (age + k * 1.9) * 6 - c)); // edge draws progressively along the path
					return <line key={`p${k}-${c}`} x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * grow} y2={a.y + (b.y - a.y) * grow}
						stroke={k === 0 ? lead : alt} strokeWidth={6} strokeLinecap="round" opacity={p.alpha} style={{filter: `drop-shadow(0 0 10px ${lead})`}} />;
				}))}
				{nodes.map((n, i) => {
					const lit = paths.some((p) => p.alpha > 0.05 && p.nodes.includes(i)); // on an active circuit
					return <circle key={i} cx={n.x} cy={n.y} r={lit ? 14 : 7} fill={lit ? lead : COLORS.violet} opacity={lit ? 1 : 0.5} />;
				})}
			</svg>
			<TokenRow cur={pathOf(d)} hops={circuit(d).map((n) => nodes[n])} age={age} alpha={paths[0].alpha} lead={lead} />
				<svg width={width} height={height} style={{position: 'absolute'}}>
					{circuit(d).map((n, i) => (
						<text key={i} x={nodes[n].x} y={nodes[n].y - 22} fill={COLORS.ink} fontFamily={FONTS.body} fontWeight={600} fontSize={20} textAnchor="middle"
							opacity={paths[0].alpha} style={{textShadow: glow(lead, 0.6), paintOrder: 'stroke', stroke: COLORS.bg, strokeWidth: 4}}>{shortLabel(pathOf(d).path[i])}</text>
					))}
				</svg>
		</AbsoluteFill>
	);
};

const ROW_Y = 958; // token row baseline: below the giant words, above the citation ticker
/** Local: the graph's prompt as token chips along the bottom; chips under the circuit's supernodes light up and send a
 * dashed link to their node; the model's output follows the last chip once the circuit has been drawn.
 * Global: ties the abstract network above to the actual sentence the released graph was traced on. */
const TokenRow: React.FC<{cur: {key: Key; path: string[]}; hops: {x: number; y: number}[]; age: number; alpha: number; lead: string}> = ({cur, hops, age, alpha, lead}) => {
	const g = graphs[cur.key] as SG;
	const toks = g.tokens.map((s) => s.replace(/^ +/, '') || '␣'); // leading spaces dropped; a bare space shown as ␣
	const ws = toks.map((s) => Math.max(26, s.length * 10.3 + 14)); // chip widths for 17 px mono
	const out = `→ ${OUTPUTS[cur.key]}`;
	const total = ws.reduce((a, b) => a + b + 6, 0) + out.length * 13 + 16; // row width at scale 1
	const k = Math.min(1, 1640 / total), x0 = 960 - (total * k) / 2; // shrink long prompts (the rabbit couplet) to fit
	const xs = ws.map((_, i) => x0 + k * (ws.slice(0, i).reduce((a, b) => a + b + 6, 0) + ws[i] / 2)); // chip centres
	const ctxOf = (label: string) => g.nodes.find((n) => n.label === label)?.ctx; // token position of a supernode
	const lit = new Set(cur.path.map(ctxOf));
	const done = smooth(age * 6 - (cur.path.length - 1)); // the circuit has reached its last hop
	return (
		<svg width={1920} height={1080} style={{position: 'absolute'}}>
			{cur.path.map((label, i) => { const c = ctxOf(label); return c === undefined ? null : ( // dashed links token -> supernode
				<line key={i} x1={xs[c]} y1={ROW_Y - 22} x2={hops[i].x} y2={hops[i].y} stroke={lead} strokeWidth={1.5} strokeDasharray="4 6" opacity={0.35 * alpha} />); })}
			{toks.map((s, i) => (
				<g key={i} transform={`translate(${xs[i]} ${ROW_Y}) scale(${k})`}>
					<rect x={-ws[i] / 2} y={-20} width={ws[i]} height={30} rx={6} fill={lit.has(i) ? lead : 'rgba(4,5,13,0.8)'} fillOpacity={lit.has(i) ? 0.3 * alpha + 0.1 : 0.8}
						stroke={lit.has(i) ? lead : COLORS.dim} strokeOpacity={lit.has(i) ? alpha : 0.5} />
					<text x={0} y={1} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={17} textAnchor="middle">{s}</text>
				</g>
			))}
			<text x={x0 + k * (total - out.length * 13)} y={ROW_Y + 1} fill={COLORS.amber} fontFamily={FONTS.mono} fontWeight={700} fontSize={22 * k} opacity={done * alpha}
				style={{textShadow: glow(COLORS.amber, 0.6)}}>{out}</text>
		</svg>
	);
};
