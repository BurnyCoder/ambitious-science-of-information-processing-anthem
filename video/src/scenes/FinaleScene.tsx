/**
 * Final chorus (key change) — ideal solving.
 * Local: gold palette. Left: a causal graph (data -> features -> circuit -> behavior, with a
 * confounding hyperparameter node); when "counterfactual"/"cause" is sung, do(circuit := c')
 * cuts the circuit's incoming edges and the downstream behavior flips color (Pearl's intervention).
 * Right: a 0/1 observation string collapses into its shortest program K(x) = min{|p| : U(p) = x}
 * when "shortest" is sung. Center: the giant sung words.
 * Global: the song's definition of "fully understanding": the most compressed theory that predicts
 * any behavior and any intervention. Sources: Pearl, "Causality" (2009); Kolmogorov (1965),
 * "Three approaches to the quantitative definition of information".
 */
import React from 'react'; // JSX
import {AbsoluteFill, random} from 'remotion'; // layer + RNG
import {wordTime} from '../lib/timeline'; // keyword timing
import {COLORS, FONTS, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {BigWords} from '../components/BigWords'; // kinetic lyrics
import type {SceneProps} from './types'; // contract

const NODES: Record<string, [number, number]> = {data: [120, 660], hyper: [380, 640], features: [170, 820], circuit: [420, 860], behavior: [700, 920]}; // node -> xy (lower left)
const EDGES: [string, string][] = [['data', 'features'], ['hyper', 'features'], ['features', 'circuit'], ['hyper', 'circuit'], ['circuit', 'behavior']]; // DAG

export const FinaleScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t, local, length} = useSceneClock(section); // time
	const doAt = wordTime(tl, section, /counterfactual/i) ?? section.startS + 0.55 * length; // intervention moment
	const kAt = wordTime(tl, section, /shortest/i) ?? section.startS + 0.3 * length; // compression moment
	const iv = smooth((t - doAt) / 0.4); // intervention progress
	const k = smooth((t - kAt) / 1.2); // compression progress
	const bits = Array.from({length: 14 * 20}, (_, i) => (random(`b${i % 20}`) > 0.5 ? '1' : '0')); // periodic string: compressible by design
	const shown = Math.floor(bits.length * (1 - k)); // characters remaining as it compresses
	return (
		<AbsoluteFill>
			<svg width={1920} height={1080} style={{position: 'absolute', opacity: smooth(local / 0.8)}}>
				{EDGES.map(([a, b], i) => {
					const cut = b === 'circuit' && iv > 0.5; // do() removes arrows into the intervened node
					return <line key={i} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke={cut ? '#ff5470' : COLORS.amber}
						strokeWidth={4} strokeDasharray={cut ? '8 10' : undefined} opacity={cut ? 0.5 : 0.85} />;
				})}
				{Object.entries(NODES).map(([name, [x, y]]) => {
					const color = name === 'circuit' && iv > 0.5 ? COLORS.lime : name === 'behavior' && iv > 0.5 ? COLORS.cyan : COLORS.amber; // changed by do()
					return (
						<g key={name}>
							<circle cx={x} cy={y} r={42} fill="rgba(4,5,13,0.85)" stroke={color} strokeWidth={4} />
							<text x={x} y={y + 7} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={18} textAnchor="middle">{name}</text>
						</g>
					);
				})}
				<text x={420} y={950} fill={COLORS.lime} fontFamily={FONTS.mono} fontSize={26} textAnchor="middle" opacity={iv}>do(circuit := c′)</text>
				<text x={80} y={1010} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={20} opacity={iv}>P(behavior | do(circuit := c′)) ≠ P(behavior)</text>
			</svg>
			<div style={{position: 'absolute', right: 70, top: 640, width: 640, fontFamily: FONTS.mono, fontSize: 18, lineHeight: 1.2, color: COLORS.amber, opacity: smooth(local / 0.8)}}>
				<div style={{opacity: 0.85, wordBreak: 'break-all'}}>{bits.slice(0, shown).join('')}</div>
				<div style={{marginTop: 24, fontSize: 34, color: COLORS.ink, opacity: k}}>K(x) = min&#123; |p| : U(p) = x &#125;</div>
				<div style={{marginTop: 10, fontSize: 20, color: COLORS.dim, opacity: k}}>{bits.length} bits → a 20-bit period × 14 · the shortest theory that predicts it all</div>
			</div>
			<BigWords tl={tl} t={t} color={COLORS.amber} y={-170} />
		</AbsoluteFill>
	);
};
