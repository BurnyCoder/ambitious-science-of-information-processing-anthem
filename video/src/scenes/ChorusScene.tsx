/**
 * Chorus — "We will know! We will understand!"
 * Local: a layered network graph fills the frame; on every downbeat a real circuit lights up through it: the
 * strongest path (greedy max-weight edges to the output) of an attribution graph released by Lindsey et al. 2025,
 * labelled with the authors' supernode names (chorus 1: Dallas -> Austin; chorus 2: 36+59 and the rabbit couplet),
 * while the sung word slams in at giant size. The second chorus swaps the palette.
 * Global: the emotional hook; "map every cause behind every behavior" = tracing circuits.
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random, useVideoConfig} from 'remotion'; // layer + RNG + size
import {lastIndexAtOrBefore} from '../lib/timeline'; // which downbeat we are in
import {COLORS, FONTS, glow, useSceneClock} from '../lib/theme'; // look + clock
import graphs from '../../public/vignettes/graphs.json'; // supernode graphs (scripts/vignette_data.py)
import {BigWords} from '../components/BigWords'; // kinetic lyrics
import {shortLabel} from '../vignettes/chorus'; // compact supernode labels
import type {SceneProps} from './types'; // contract

const COLS = 7; // graph layers
const ROWS = 6; // nodes per layer

type SG = {nodes: {label: string; output: boolean}[]; edges: {source: string; target: string; weight: number}[]}; // supernode graph
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
const NAMED = [strongestPaths(graphs.dallas), [...strongestPaths(graphs.calc).slice(0, 3), ...strongestPaths(graphs.rabbit).slice(0, 3)]]; // per chorus
if (NAMED.some((n) => n.length === 0)) throw new Error('graphs.json yields no circuit path; re-run scripts/vignette_data.py'); // fail at bundle time, not per frame
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7); // label -> stable row

export const ChorusScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t} = useSceneClock(section); // absolute time
	const {width, height} = useVideoConfig(); // frame size
	const [lead, alt] = section.occurrence % 2 === 1 ? [COLORS.cyan, COLORS.magenta] : [COLORS.magenta, COLORS.cyan]; // palette per repeat
	const nodes = useMemo(() => Array.from({length: COLS * ROWS}, (_, i) => ({ // node grid with seeded jitter
		x: 140 + (Math.floor(i / ROWS) / (COLS - 1)) * (width - 280) + (random(`jx${i}`) - 0.5) * 60,
		y: 150 + ((i % ROWS) / (ROWS - 1)) * (height - 300) + (random(`jy${i}`) - 0.5) * 50,
	})), [width, height]);
	const d = lastIndexAtOrBefore(tl.downbeats, t); // current bar index (global)
	const named = NAMED[(section.occurrence - 1) % NAMED.length]; // this chorus's circuits
	const pathOf = (k: number) => named[((k % named.length) + named.length) % named.length]; // bar k -> one named path
	const circuit = (k: number) => pathOf(k).map((label, i, all) => Math.round((i * (COLS - 1)) / (all.length - 1)) * ROWS + (hash(label) % ROWS)); // node per hop
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
				<svg width={width} height={height} style={{position: 'absolute'}}>
					{circuit(d).map((n, i) => (
						<text key={i} x={nodes[n].x} y={nodes[n].y - 22} fill={COLORS.ink} fontFamily={FONTS.body} fontWeight={600} fontSize={20} textAnchor="middle"
							opacity={paths[0].alpha} style={{textShadow: glow(lead, 0.6), paintOrder: 'stroke', stroke: COLORS.bg, strokeWidth: 4}}>{shortLabel(pathOf(d)[i])}</text>
					))}
				</svg>
			<BigWords tl={tl} t={t} color={lead} y={-20} />
		</AbsoluteFill>
	);
};
