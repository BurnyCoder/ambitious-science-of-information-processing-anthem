/**
 * Chorus — "We will know! We will understand!"
 * Local: the model at work, in 3D, laid out on the released attribution graph's own axes (Lindsey et al. 2025: every
 * supernode has a token position `ctx` and a `layer`): one column per prompt token, 18 layers up. Each (token, layer)
 * cell is a small cluster of feature points that flicker with the music; residual streams run up every column with
 * dots flowing through them; attention arcs rise from earlier to later tokens (higher for farther pairs, tilted in
 * depth) and pulse on the beat.
 * On every downbeat a real circuit lights up through it: the strongest path (greedy max-weight edges to the output)
 * of the graph, its supernodes placed at their (ctx, layer), its edges thick with particles flowing to the output,
 * labelled with the authors' names (chorus 1: Dallas -> Austin; chorus 2 cuts between 36+59 and the rabbit couplet).
 * The camera orbits slowly and kicks in on each downbeat. Along the bottom the graph's real prompt tokens light up
 * under the circuit, with dashed links up to its supernodes; the sung word slams in at giant size (drawn by Anthem).
 * Global: the emotional hook; "map every cause behind every behavior" = tracing circuits. The flicker, the arcs and the
 * fading columns right of the prompt (the positions the model writes next) are schematic (seeded); the circuit, its
 * positions, labels, prompt and output are the released data.
 * Sources: graphs from https://transformer-circuits.pub/2025/attribution-graphs/ (scripts/vignette_data.py);
 * Three.js points/lines via components/three.tsx.
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random} from 'remotion'; // layer + RNG
import {beatPulse, featureAt, lastIndexAtOrBefore, type Section, type Timeline} from '../lib/timeline'; // timing
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {CameraRig, GlowLines, GlowPoints, Stage, projectToScreen, rgb} from '../components/three'; // 3D blocks
import graphs from '../../public/vignettes/graphs.json'; // supernode graphs (scripts/vignette_data.py)
import {OUTPUTS, shortLabel} from '../vignettes/chorus'; // model outputs + compact supernode labels
import type {SceneProps} from './types'; // contract

type Vec = [number, number, number]; // world point
type SG = {tokens: string[]; nodes: {label: string; output: boolean; ctx: number; layer: number}[]; edges: {source: string; target: string; weight: number}[]}; // supernode graph
type Key = keyof typeof OUTPUTS; // dallas | rabbit | calc
const LAYERS = 18; // the graphs' layer axis: inputs near 0, the output at 18
const FOV = 50; // camera field of view (degrees)
const TARGET: Vec = [0, 0, 0]; // look-at point: the centre of the circuit's tokens
const layerY = (l: number) => -2.9 + l * 0.44; // layer -> height: layer 18 under the HUD, layer 0 behind the giant words

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
const circuitsOf = (key: Key, n = 99) => strongestPaths(graphs[key] as SG).slice(0, n).map((path) => ({key, path})); // paths tagged with their graph
const NAMED = [circuitsOf('dallas'), [...circuitsOf('calc', 3), ...circuitsOf('rabbit', 3)]]; // per chorus
if (NAMED.some((n) => n.length === 0)) throw new Error('graphs.json yields no circuit path; re-run scripts/vignette_data.py'); // fail at bundle time, not per frame

/** Local: x of each token column, centred on the tokens the circuit uses (so the circuit sits mid-frame), and how many
 * fading "next position" columns fill the frame to the right of the prompt. */
const columns = (key: Key) => {
	const g = graphs[key] as SG, n = g.tokens.length;
	const step = Math.min(2.2, 15 / (n - 1)); // world units between token columns
	const ctxs = g.nodes.map((nd) => nd.ctx), mid = (Math.min(...ctxs) + Math.max(...ctxs)) / 2;
	const x = (c: number) => (c - mid) * step - 0.6; // a little left of centre: the right panel slot starts at x = 1270 px
	return {g, n, step, x, ghost: Math.min(24, Math.max(0, Math.ceil((13 - x(n - 1)) / step)))};
};

/** Local: everything the chorus shows at t that depends on the bar and the camera: the bar index, the circuit of
 * bar k, the graph's columns, the camera and the world -> screen projection. Global: shared by the scene and by
 * stage/anchors.ts (chorusAnchor), so the panels dive out of what is drawn. */
export const chorusView = (tl: Timeline, section: Section, t: number) => {
	const d = lastIndexAtOrBefore(tl.downbeats, t); // current bar index (global)
	const named = NAMED[(section.occurrence - 1) % NAMED.length]; // this chorus's circuits
	const pathOf = (k: number) => named[((k % named.length) + named.length) % named.length]; // bar k -> one named path
	const cur = pathOf(d), cols = columns(cur.key);
	const theta = 0.3 * Math.sin((t - section.startS) * 0.22); // slow orbit about the vertical axis
	const r = 15.5 - 1.3 * beatPulse(tl.downbeats, t, 0.35); // zoom kick on each downbeat
	const cam: Vec = [r * Math.sin(theta), 1.4, r * Math.cos(theta)];
	const nodeAt = (label: string): Vec => { const nd = cols.g.nodes.find((n) => n.label === label)!; return [cols.x(nd.ctx), layerY(nd.layer), 0]; }; // supernode position
	const project = (p: Vec) => projectToScreen(p, cam, TARGET, FOV); // world -> pixels
	return {d, pathOf, cur, cols, cam, nodeAt, project};
};

/** Local: screen point of a (token, layer) cell chosen by `seed`, under the current camera.
 * Global: stage/anchors.ts dives chorus panels out of (and docks them into) this cell. */
export const chorusAnchor = (tl: Timeline, section: Section, t: number, seed: number) => {
	const {cols, project} = chorusView(tl, section, t);
	return project([cols.x(seed % cols.n), layerY(3 + (Math.floor(seed / cols.n) % 13)), 0]);
};

/** Local: flat xyz/rgb arrays plus a segment helper. Global: the per-frame geometry handed to GlowPoints/GlowLines. */
const buffers = () => {
	const p: number[] = [], c: number[] = [];
	return {p, c, point: (a: Vec, col: Vec) => { p.push(...a); c.push(...col); }, seg: (a: Vec, b: Vec, col: Vec) => { p.push(...a, ...b); c.push(...col, ...col); },
		done: () => ({p: new Float32Array(p), c: new Float32Array(c)})};
};
const lerp = (a: Vec, b: Vec, u: number): Vec => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

export const ChorusScene: React.FC<SceneProps> = ({tl, section}) => {
	const {frame, t} = useSceneClock(section); // absolute time
	const [lead, alt] = section.occurrence % 2 === 1 ? [COLORS.cyan, COLORS.magenta] : [COLORS.magenta, COLORS.cyan]; // palette per repeat
	const view = chorusView(tl, section, t);
	const {d, pathOf, cur, cols, cam, nodeAt, project} = view;
	const age = d >= 0 ? t - tl.downbeats[d] : 99; // seconds since this bar began
	const paths = [0, 1, 2].map((back) => ({c: pathOf(d - back), alpha: Math.max(0, 1 - (age + back * 1.9) / 3.5), back}))
		.filter((p) => p.c.key === cur.key && p.alpha > 0.02); // current + fading previous circuits of the same graph
	const geo = useMemo(() => {
		const energy = featureAt(tl.energy, tl.fps, t), pulse = beatPulse(tl.beats, t); // music drive
		const {g, n, step, x, ghost} = cols;
		const lit = new Set(paths.flatMap((p) => p.c.path.map((l) => { const nd = g.nodes.find((q) => q.label === l)!; return `${nd.ctx}:${Math.round(nd.layer)}`; }))); // cells on a circuit
		const feat = buffers(), streams = buffers(), arcs = buffers(), sparks = buffers(), graph = buffers(), circuit = buffers(), hubs = buffers();
		const per = Math.max(6, Math.round(110 / n)); // feature points per cell: short prompts get denser cells
		for (let l = 0; l <= LAYERS; l++) streams.seg([x(0), layerY(l), 0], [x(n + ghost - 1), layerY(l), 0], rgb(COLORS.violet, 0.1)); // layer lattice
		for (let c = 0; c < n + ghost; c++) {
			const fade = c < n ? 1 : 0.55 * (1 - (c - n + 1) / (ghost + 1)); // prompt columns full, next positions fading out
			streams.seg([x(c), layerY(0), 0], [x(c), layerY(LAYERS), 0], rgb(COLORS.violet, 0.35 * fade)); // residual stream
			for (let k = 0; k < 4; k++) { // activations flowing up the stream
				const u = (t * 0.45 + k / 4 + random(`rs${c}`)) % 1;
				sparks.point([x(c), layerY(0) + u * (layerY(LAYERS) - layerY(0)), 0], rgb(lead, 0.9 * fade));
			}
			for (let l = 0; l <= LAYERS; l++) for (let k = 0; k < per; k++) { // feature cluster of cell (c, l)
				const s = `f${c}-${l}-${k}`, on = lit.has(`${c}:${l}`);
				const act = Math.max(0, Math.sin(t * (1.2 + 3 * random(`${s}w`)) + 6.28 * random(`${s}p`))) ** 3; // sparse flashes
				feat.point([x(c) + (random(`${s}x`) - 0.5) * 0.45 * step, layerY(l) + (random(`${s}y`) - 0.5) * 0.3, (random(`${s}z`) - 0.5) * 1.8],
					on ? rgb(lead, 1.3) : rgb(random(`${s}c`) > 0.6 ? COLORS.cyan : COLORS.violet, fade * (0.2 + act * (0.5 + 0.9 * energy))));
			}
		}
		const bar = Math.max(0, d), barAge = Math.min(age, 9); // arcs are reseeded every bar
		for (let i = 0; i < Math.min(48, 2 * n + 8); i++) { // attention: earlier token -> later token, bulging in depth
			const s = `att${cur.key}${bar}-${i}`, dst = 1 + Math.floor(random(`${s}d`) * (n - 1)), src = Math.floor(random(`${s}s`) * dst);
			const l = 1 + Math.floor(random(`${s}l`) * (LAYERS - 2)), tilt = (0.2 + 0.4 * random(`${s}b`)) * (random(`${s}side`) > 0.5 ? 1 : -1);
			const lift = Math.min(2.4, 0.2 + 0.18 * (x(dst) - x(src))); // an arc diagram: farther pairs arc higher
			const at = (u: number): Vec => { const b = lerp([x(src), layerY(l), 0], [x(dst), layerY(l + 1), 0], u); return [b[0], b[1] + Math.sin(Math.PI * u) * lift, Math.sin(Math.PI * u) * tilt]; };
			const col = rgb(alt, 0.18 + 0.5 * pulse);
			for (let k = 0; k < 16; k++) arcs.seg(at(k / 16), at((k + 1) / 16), col);
			sparks.point(at((barAge * (0.5 + random(`${s}v`))) % 1), rgb(alt, 1.2)); // a particle riding the arc
		}
		for (const e of g.edges) graph.seg(nodeAt(e.source), nodeAt(e.target), rgb(lead, 0.16)); // the whole released graph, faint
		for (const nd of g.nodes) hubs.point(nodeAt(nd.label), rgb(lead, 0.45));
		for (const p of paths) p.c.path.slice(1).forEach((label, h) => { // the lit circuit: thick, growing edges with particles
			const a = nodeAt(p.c.path[h]), b = nodeAt(label), grow = Math.min(1, Math.max(0, (age + p.back * 1.9) * 6 - h));
			const col = rgb(p.back ? alt : lead, 1.3 * p.alpha), end = lerp(a, b, grow);
			for (const o of [[0, 0, 0], [0.04, 0, 0], [-0.04, 0, 0], [0, 0.04, 0], [0, -0.04, 0], [0, 0, 0.05]] as Vec[])
				circuit.seg([a[0] + o[0], a[1] + o[1], a[2] + o[2]], [end[0] + o[0], end[1] + o[1], end[2] + o[2]], col);
			for (let k = 0; k < 10; k++) { const u = (age * 1.4 + k / 10) % 1; if (u < grow) sparks.point(lerp(a, b, u), rgb(COLORS.ink, 1.1 * p.alpha)); }
			hubs.point(a, rgb(lead, 1.6 * p.alpha));
			if (grow >= 1) hubs.point(b, rgb(h === p.c.path.length - 2 ? COLORS.amber : lead, 1.6 * p.alpha));
		});
		return {feat: feat.done(), streams: streams.done(), arcs: arcs.done(), sparks: sparks.done(), graph: graph.done(), circuit: circuit.done(), hubs: hubs.done()};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [frame, section.index]);
	const hops = cur.path.map((label) => project(nodeAt(label))); // the circuit on screen
	const labelY = hops.reduce<number[]>((ys, h, i) => { // greedy de-overlap: a label that would sit on an earlier one moves up
		let y = h.y - (i === hops.length - 1 ? 30 : 22);
		while (ys.some((u, j) => Math.abs(u - y) < 24 && Math.abs(hops[j].x - h.x) < 140)) y -= 24;
		return [...ys, y];
	}, []);
	const done = smooth(age * 6 - (cur.path.length - 1)); // the circuit has reached the output
	const alpha = paths[0]?.alpha ?? 0;
	return (
		<AbsoluteFill>
			<Stage fov={FOV}>
				<CameraRig position={cam} target={TARGET} />
				<GlowLines positions={geo.streams.p} colors={geo.streams.c} opacity={0.6} />
				<GlowLines positions={geo.arcs.p} colors={geo.arcs.c} opacity={0.8} />
				<GlowLines positions={geo.graph.p} colors={geo.graph.c} opacity={0.9} />
				<GlowPoints positions={geo.feat.p} colors={geo.feat.c} size={0.2} />
				<GlowPoints positions={geo.sparks.p} colors={geo.sparks.c} size={0.22} />
				<GlowLines positions={geo.circuit.p} colors={geo.circuit.c} opacity={1} />
				<GlowPoints positions={geo.hubs.p} colors={geo.hubs.c} size={0.75} />
			</Stage>
			<TokenRow cur={cur} hops={hops} age={age} alpha={alpha} lead={lead} />
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				{hops.map((h, i) => { const last = i === hops.length - 1; return (
					<text key={i} x={h.x} y={labelY[i]} fill={last ? COLORS.amber : COLORS.ink} fontFamily={last ? FONTS.display : FONTS.body} fontWeight={last ? 900 : 600}
						fontSize={last ? 34 : 20} textAnchor="middle" opacity={alpha * (last ? done : 1)}
						style={{textShadow: glow(last ? COLORS.amber : lead, 0.6), paintOrder: 'stroke', stroke: COLORS.bg, strokeWidth: 4}}>{last ? `→ ${OUTPUTS[cur.key]}` : shortLabel(cur.path[i])}</text>); })}
			</svg>
		</AbsoluteFill>
	);
};

const ROW_Y = 958; // token row baseline: below the giant words, above the citation ticker
/** Local: the graph's prompt as token chips along the bottom; chips under the circuit's supernodes light up and send a
 * dashed link to their node; the model's output follows the last chip once the circuit has been drawn.
 * Global: ties the network above to the actual sentence the released graph was traced on. */
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
