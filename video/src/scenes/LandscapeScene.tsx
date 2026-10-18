/**
 * Pre-chorus 1 — gradient descent through a non-convex landscape into flat minima.
 * Local: a toy 2D loss surface (one wide basin, one sharp narrow basin, a saddle, ripples)
 * drawn as a height-colored point lattice; 28 noisy-gradient-descent particles, whose
 * trajectories are precomputed deterministically, descend with glowing trails.
 * Global: illustrates the lyric "past every saddle, to valleys flat and wide"; the flat-minima
 * <-> generalization link is the hypothesis of Hochreiter & Schmidhuber (1997, Neural Computation
 * "Flat Minima") and Keskar et al. (2017, ICLR, arXiv:1609.04836). This surface is illustrative only.
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random} from 'remotion'; // layer + seeded RNG
import {beatPulse} from '../lib/timeline'; // beat kick
import {COLORS, useSceneClock} from '../lib/theme'; // look + clock
import {CameraRig, GlowLines, GlowPoints, Stage, rgb} from '../components/three'; // 3D blocks
import {Caption} from '../components/Overlays'; // labels
import type {SceneProps} from './types'; // contract

const N = 90; // lattice resolution per side
const SPAN = 24; // world size of the surface
const RUNS = 28; // SGD particles
const STEPS = 400; // optimizer steps per particle
const TRAIL = 30; // trail length in steps
const LR = 0.5; // learning rate η (below 2/curvature of the sharp basin)

/** Local: toy loss L(x, y). Global: same function for surface heights and gradients. */
const loss = (x: number, y: number): number =>
	2.8 - 2.4 * Math.exp(-((x - 5) ** 2 + (y - 3) ** 2) / 30) // wide, flat basin
	- 2.0 * Math.exp(-((x + 6) ** 2 + (y + 5) ** 2) / 2.5) // sharp, narrow basin
	+ 0.25 * Math.sin(0.9 * x) * Math.cos(0.8 * y) // ruggedness
	+ 0.12 * (x * y) / 20 // saddle-shaped tilt
	+ 0.004 * (x * x + y * y); // bowl so particles stay on the map

/** Local: central-difference gradient. Global: drives the particle dynamics. */
const grad = (x: number, y: number): [number, number] => {
	const h = 1e-3; // step for finite differences
	return [(loss(x + h, y) - loss(x - h, y)) / (2 * h), (loss(x, y + h) - loss(x, y - h)) / (2 * h)];
};

export const LandscapeScene: React.FC<SceneProps> = ({tl, section}) => {
	const {frame, t, local, progress} = useSceneClock(section); // time
	const pulse = beatPulse(tl.beats, t); // beat kick
	const surface = useMemo(() => { // static lattice: positions + height colors
		const pos = new Float32Array(N * N * 3);
		const col = new Float32Array(N * N * 3);
		for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
			const x = (i / (N - 1) - 0.5) * SPAN; // world x
			const y = (j / (N - 1) - 0.5) * SPAN; // world y (depth)
			const z = loss(x, y); // height
			const k = (i * N + j) * 3; // array offset
			pos.set([x, z * 2, y], k); // y-up world: height on the Y axis (x2 exaggeration)
			const c = rgb(z < 1.2 ? COLORS.lime : z < 2.2 ? COLORS.cyan : COLORS.violet, 0.55); // height bands
			col.set(c, k);
		}
		return {pos, col};
	}, []);
	const runs = useMemo(() => Array.from({length: RUNS}, (_, r) => { // precomputed noisy GD paths
		let x = (random(`x${r}`) - 0.5) * SPAN * 0.9; // random start
		let y = (random(`y${r}`) - 0.5) * SPAN * 0.9;
		const path: [number, number, number][] = [];
		for (let s = 0; s < STEPS; s++) {
			const [gx, gy] = grad(x, y); // gradient at the current point
			const noise = 0.18 * (1 - s / STEPS); // annealed SGD noise
			const norm = Math.max(1, Math.hypot(gx, gy) * LR / 0.6); // clip each step to 0.6 units (avoids oscillation)
			x -= (LR * gx) / norm + noise * (random(`nx${r}-${s}`) - 0.5) * 2; // step + noise
			y -= (LR * gy) / norm + noise * (random(`ny${r}-${s}`) - 0.5) * 2;
			path.push([x, loss(x, y) * 2 + 0.15, y]); // world position slightly above the surface
		}
		return path;
	}), []);
	const {ppos, pcol, tpos, tcol} = useMemo(() => { // per-frame particle + trail arrays
		const step = Math.min(STEPS - 1, Math.floor(Math.pow(progress, 0.8) * STEPS)); // ease: fast start, settle
		const ppos = new Float32Array(RUNS * 3);
		const pcol = new Float32Array(RUNS * 3);
		const tpos = new Float32Array(RUNS * TRAIL * 6);
		const tcol = new Float32Array(RUNS * TRAIL * 6);
		runs.forEach((path, r) => {
			ppos.set(path[step], r * 3); // particle head
			pcol.set(rgb(COLORS.amber, 1.4 + pulse), r * 3); // bright gold
			for (let k = 0; k < TRAIL; k++) {
				const a = path[Math.max(0, step - k - 1)]; // older point
				const b = path[Math.max(0, step - k)]; // newer point
				const fade = 1 - k / TRAIL; // trail fades out
				tpos.set([...a, ...b], (r * TRAIL + k) * 6);
				const c = rgb(COLORS.amber, 0.8 * fade);
				tcol.set([...c, ...c], (r * TRAIL + k) * 6);
			}
		});
		return {ppos, pcol, tpos, tcol};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [frame]);
	const theta = 0.6 + local * 0.08; // slow orbit
	return (
		<AbsoluteFill>
			<Stage fov={50}>
				<CameraRig position={[Math.cos(theta) * 26, 15 - progress * 4, Math.sin(theta) * 26]} target={[0, 1, 0]} />
				<GlowPoints positions={surface.pos} colors={surface.col} size={0.22} opacity={0.9} />
				<GlowLines positions={tpos} colors={tcol} opacity={0.9} />
				<GlowPoints positions={ppos} colors={pcol} size={0.9 + 0.3 * pulse} />
			</Stage>
			<Caption local={local} at={0.8} x={70} y={110} title="non-convex loss landscape" sub="noisy gradient descent: θ ← θ − η∇L(θ) + ξ" color={COLORS.amber} />
			<Caption local={local} at={progress > 0 ? 6 : 99} x={1180} y={110} title="flat minima ↔ generalization?" sub="Hochreiter & Schmidhuber 1997 · Keskar et al. 2017 (toy surface)" color={COLORS.lime} size={30} />
		</AbsoluteFill>
	);
};
