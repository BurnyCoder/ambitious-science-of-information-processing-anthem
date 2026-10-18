/**
 * Verse 1 — "a matrix and a bend, repeated without end".
 * Local: the camera flies through a stack of layers (grids of neurons) joined by sparse
 * weight lines; an activation wave travels forward layer by layer and pulses on beats.
 * A 2D panel shows h_{l+1} = σ(W_l h_l + b_l) with a ReLU plot and a growing parameter count.
 * Global: introduces depth = composition of linear maps and nonlinearities, which the
 * landscape scene then trains.
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random} from 'remotion'; // layer + seeded RNG
import {beatPulse, featureAt} from '../lib/timeline'; // audio reactivity
import {COLORS, FONTS, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {CameraRig, GlowLines, GlowPoints, Stage, rgb} from '../components/three'; // 3D blocks
import {Caption} from '../components/Overlays'; // labels
import type {SceneProps} from './types'; // contract

const LAYERS = 16; // depth of the stack
const COLS = 12; // neurons per row
const ROWS = 7; // rows per layer
const GAP = 6; // distance between layers (world units)
const EDGES = 90; // weight lines drawn per layer pair

export const LayersScene: React.FC<SceneProps> = ({tl, section}) => {
	const {frame, fps, t, local, progress} = useSceneClock(section); // time
	const energy = featureAt(tl.energy, fps, t); // loudness
	const pulse = beatPulse(tl.beats, t); // beat kick
	const grid = useMemo(() => { // static neuron positions: layer l at z = -l*GAP
		const p: number[] = [];
		for (let l = 0; l < LAYERS; l++) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) p.push((c - (COLS - 1) / 2) * 1.1, (r - (ROWS - 1) / 2) * 1.1, -l * GAP);
		return p;
	}, []);
	const edges = useMemo(() => { // seeded sparse connectivity between consecutive layers
		const e: [number, number][] = [];
		for (let l = 0; l < LAYERS - 1; l++) for (let k = 0; k < EDGES; k++) {
			const a = Math.floor(random(`ea${l}-${k}`) * ROWS * COLS); // source neuron in layer l
			const b = Math.floor(random(`eb${l}-${k}`) * ROWS * COLS); // target neuron in layer l+1
			e.push([l * ROWS * COLS + a, (l + 1) * ROWS * COLS + b]);
		}
		return e;
	}, []);
	const {pos, col, lpos, lcol} = useMemo(() => { // per-frame colors (activation wave)
		const wave = (t * 2.2) % (LAYERS + 4); // which layer the wave front is on
		const n = grid.length / 3; // neuron count
		const col = new Float32Array(n * 3); // rgb per neuron
		const act = new Float32Array(n); // activation per neuron (for edges)
		for (let i = 0; i < n; i++) {
			const l = Math.floor(i / (ROWS * COLS)); // layer index
			const front = Math.exp(-((l - wave) ** 2) / 1.5); // gaussian wave front
			const h = Math.max(0, Math.sin(i * 12.9898 + t * 1.7)); // ReLU of a pseudo pre-activation
			act[i] = front * h; // sparse, forward-moving activation
			const [r, g, b] = act[i] > 0.15 ? rgb(COLORS.cyan, 0.4 + 1.6 * act[i] * (1 + pulse)) : rgb(COLORS.violet, 0.35 + 0.3 * energy);
			col.set([r, g, b], i * 3);
		}
		const lpos = new Float32Array(edges.length * 6); // two xyz per edge
		const lcol = new Float32Array(edges.length * 6); // two rgb per edge
		edges.forEach(([a, b], k) => {
			lpos.set(grid.slice(a * 3, a * 3 + 3), k * 6); // start vertex
			lpos.set(grid.slice(b * 3, b * 3 + 3), k * 6 + 3); // end vertex
			const s = 0.08 + 0.9 * Math.max(act[a], act[b]); // lit where signal flows
			const c = rgb(COLORS.magenta, s);
			lcol.set([...c, ...c], k * 6);
		});
		return {pos: new Float32Array(grid), col, lpos, lcol};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [frame]);
	const camZ = 14 - progress * (LAYERS * GAP * 0.8); // fly forward through ~80% of the stack
	const params = Math.min(12, 3 + progress * 11); // log10 of the parameter counter, 1e3 -> 1e12
	return (
		<AbsoluteFill>
			<Stage>
				<CameraRig position={[Math.sin(local * 0.4) * 3, Math.cos(local * 0.3) * 1.5 + 1, camZ]} target={[0, 0, camZ - 20]} />
				<GlowLines positions={lpos} colors={lcol} opacity={0.55} />
				<GlowPoints positions={pos} colors={col} size={0.45 + 0.15 * pulse} />
			</Stage>
			<Caption local={local} at={1} x={70} y={110} title={<span style={{fontFamily: FONTS.mono}}>h<sub>l+1</sub> = σ(W<sub>l</sub> h<sub>l</sub> + b<sub>l</sub>)</span>} sub="the most general linear map, then one bend — composed ad infinitum" />
			<svg width={460} height={150} style={{position: 'absolute', left: 74, top: 250, opacity: smooth((local - 2) / 0.6)}}>
				<line x1={10} y1={120} x2={250} y2={120} stroke={COLORS.dim} /> {/* x axis */}
				<line x1={130} y1={10} x2={130} y2={140} stroke={COLORS.dim} /> {/* y axis */}
				<polyline points="10,120 130,120 240,20" fill="none" stroke={COLORS.cyan} strokeWidth={5} /> {/* ReLU */}
				<text x={150} y={40} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={20}>ReLU(z)=max(0,z)</text>
			</svg>
			<div style={{position: 'absolute', right: 70, top: 110, fontFamily: FONTS.mono, fontSize: 30, color: COLORS.ink, textAlign: 'right', opacity: smooth((local - 3) / 0.6)}}>
				parameters ≈ 10<sup>{params.toFixed(1)}</sup>
				<div style={{fontSize: 20, color: COLORS.dim}}>layers stacked: {Math.floor(2 + progress * 118)}</div>
			</div>
		</AbsoluteFill>
	);
};
