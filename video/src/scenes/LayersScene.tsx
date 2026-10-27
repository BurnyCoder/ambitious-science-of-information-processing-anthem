/**
 * Verse 1 — "a matrix and a bend, repeated without end".
 * Local: the camera flies through a stack of layers (grids of neurons) joined by sparse
 * weight lines; an activation wave travels forward layer by layer and pulses on beats.
 * The layer equation, the bend and the parameter count are figure cards around it (content/vignettes.toml).
 * Global: introduces depth = composition of linear maps and nonlinearities, which the
 * landscape scene then trains.
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random} from 'remotion'; // layer + seeded RNG
import {beatPulse, featureAt} from '../lib/timeline'; // audio reactivity
import {COLORS, useSceneClock} from '../lib/theme'; // look + clock
import {CameraRig, GlowLines, GlowPoints, Stage, rgb} from '../components/three'; // 3D blocks
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
	return (
		<AbsoluteFill>
			<Stage>
				<CameraRig position={[Math.sin(local * 0.4) * 3, Math.cos(local * 0.3) * 1.5 + 1, camZ]} target={[0, 0, camZ - 20]} />
				<GlowLines positions={lpos} colors={lcol} opacity={0.55} />
				<GlowPoints positions={pos} colors={col} size={0.45 + 0.15 * pulse} />
			</Stage>
		</AbsoluteFill>
	);
};
