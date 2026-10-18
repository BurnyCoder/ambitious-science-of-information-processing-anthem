/**
 * Chorus — "We will know! We will understand!"
 * Local: a layered network graph fills the frame; on every downbeat a new seeded path
 * (a "circuit") lights up through it, while the sung word slams in at giant size.
 * Second chorus swaps the palette (magenta lead) so repeats are not identical.
 * Global: the emotional hook; "map every cause behind every behavior" = tracing circuits.
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random, useVideoConfig} from 'remotion'; // layer + RNG + size
import {lastIndexAtOrBefore} from '../lib/timeline'; // which downbeat we are in
import {COLORS, useSceneClock} from '../lib/theme'; // look + clock
import {BigWords} from '../components/BigWords'; // kinetic lyrics
import type {SceneProps} from './types'; // contract

const COLS = 7; // graph layers
const ROWS = 6; // nodes per layer

export const ChorusScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t} = useSceneClock(section); // absolute time
	const {width, height} = useVideoConfig(); // frame size
	const [lead, alt] = section.occurrence % 2 === 1 ? [COLORS.cyan, COLORS.magenta] : [COLORS.magenta, COLORS.cyan]; // palette per repeat
	const nodes = useMemo(() => Array.from({length: COLS * ROWS}, (_, i) => ({ // node grid with seeded jitter
		x: 140 + (Math.floor(i / ROWS) / (COLS - 1)) * (width - 280) + (random(`jx${i}`) - 0.5) * 60,
		y: 150 + ((i % ROWS) / (ROWS - 1)) * (height - 300) + (random(`jy${i}`) - 0.5) * 50,
	})), [width, height]);
	const d = lastIndexAtOrBefore(tl.downbeats, t); // current bar index (global)
	const circuit = (k: number) => Array.from({length: COLS}, (_, c) => c * ROWS + Math.floor(random(`c${k}-${c}`) * ROWS)); // one node per layer
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
			<BigWords tl={tl} t={t} color={lead} y={-20} />
		</AbsoluteFill>
	);
};
