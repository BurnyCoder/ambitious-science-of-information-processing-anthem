/**
 * Pre-chorus 2 — "structure everywhere ... geometry that mirrors the world ... the bigger they get, the crisper".
 * Local: three feature manifolds as point clouds — a 12-cluster ring (cyclic concepts like
 * months), a helix (ordered/temporal concepts) and a sphere shell (spatial concepts) — that start
 * blurred and sharpen as the section progresses (stand-in for model scale), plus a "function vector"
 * arrow that appears when that phrase is sung.
 * Global: grounded in reported findings: circular features for days/months (Engels et al. 2024,
 * arXiv:2405.14860), linear space/time representations sharper in larger models (Gurnee & Tegmark 2023,
 * arXiv:2310.02207), function vectors (Todd et al. 2023, arXiv:2310.15213). Geometry here is schematic.
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random} from 'remotion'; // layer + RNG
import {beatPulse, wordTime} from '../lib/timeline'; // timing
import {COLORS, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {CameraRig, GlowLines, GlowPoints, Stage, rgb} from '../components/three'; // 3D blocks
import {Caption} from '../components/Overlays'; // labels
import type {SceneProps} from './types'; // contract

const PER = 700; // points per manifold

/** Local: clean sample k of manifold m, in its own frame. Global: the "true" geometry the noise hides. */
const sample = (m: number, k: number): [number, number, number] => {
	const u = k / PER; // 0..1 along the manifold
	if (m === 0) { const a = Math.round(u * 12) / 12 * Math.PI * 2; return [Math.cos(a) * 3, Math.sin(a) * 3, 0]; } // 12 clusters on a circle
	if (m === 1) { const a = u * Math.PI * 6; return [Math.cos(a) * 1.6, (u - 0.5) * 7, Math.sin(a) * 1.6]; } // helix
	const th = Math.acos(1 - 2 * random(`s${k}`)); const ph = random(`p${k}`) * Math.PI * 2; // uniform sphere
	return [Math.sin(th) * Math.cos(ph) * 2.4, Math.sin(th) * Math.sin(ph) * 2.4, Math.cos(th) * 2.4];
};

export const ManifoldsScene: React.FC<SceneProps> = ({tl, section}) => {
	const {frame, t, local, progress} = useSceneClock(section); // time
	const pulse = beatPulse(tl.beats, t); // beat kick
	const fvAt = wordTime(tl, section, /function/i) ?? section.startS + 4; // "function vectors" sung
	const {pos, col} = useMemo(() => {
		const blur = 1.6 * Math.pow(1 - progress, 1.5) + 0.04; // noise shrinks: "crisper" with scale
		const pos = new Float32Array(3 * PER * 3);
		const col = new Float32Array(3 * PER * 3);
		const centers: [number, number, number][] = [[-8, 0, 0], [0, 0, 0], [8, 0, 0]]; // three manifolds side by side
		const colors = [COLORS.cyan, COLORS.magenta, COLORS.lime];
		for (let m = 0; m < 3; m++) {
			const rot = local * (0.35 + 0.1 * m); // each spins at its own rate
			for (let k = 0; k < PER; k++) {
				const [x, y, z] = sample(m, k); // clean point
				const n = [0, 1, 2].map((d) => (random(`n${m}-${k}-${d}`) - 0.5) * 2 * blur); // fixed noise direction, shrinking
				const xr = (x + n[0]) * Math.cos(rot) + (z + n[2]) * Math.sin(rot); // rotate about Y
				const zr = -(x + n[0]) * Math.sin(rot) + (z + n[2]) * Math.cos(rot);
				const i = (m * PER + k) * 3; // offset
				pos.set([centers[m][0] + xr, centers[m][1] + y + n[1], centers[m][2] + zr], i);
				col.set(rgb(colors[m], 0.5 + 0.6 * (1 - blur / 1.64) + 0.3 * pulse), i); // crisper = brighter
			}
		}
		return {pos, col};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [frame]);
	const fv = smooth((t - fvAt) / 0.4); // arrow reveal
	const arrow = useMemo(() => { // "function vector": arrow from the ring's center outwards
		const tip: [number, number, number] = [-8 + 4.5 * fv, 3.5 * fv, 2 * fv];
		const p = new Float32Array([-8, 0, 0, ...tip, ...tip, tip[0] - 0.5, tip[1] - 0.1, tip[2], ...tip, tip[0] - 0.2, tip[1] - 0.5, tip[2]]);
		const c = new Float32Array(Array.from({length: 6}, () => rgb(COLORS.amber, 1.5)).flat());
		return {p, c};
	}, [fv]);
	return (
		<AbsoluteFill>
			<Stage fov={50}>
				<CameraRig position={[0, 2.5, 19 - progress * 3]} target={[0, 0, 0]} />
				<GlowPoints positions={pos} colors={col} size={0.28} />
				<GlowLines positions={arrow.p} colors={arrow.c} opacity={fv} />
			</Stage>
			<Caption local={local} at={0.5} x={70} y={110} title="structure everywhere" sub="features as regions with geometry: cycles, orderings, spaces" color={COLORS.magenta} />
			<Caption local={local} at={fvAt - section.startS} x={70} y={260} title="function vector" sub="a task compressed into one portable vector" color={COLORS.amber} size={28} />
			<Caption local={local} at={Math.max(3, local > 0 ? (section.endS - section.startS) * 0.55 : 99)} x={1150} y={110} title="bigger → crisper" sub="larger models represent concepts more cleanly" color={COLORS.lime} size={30} />
		</AbsoluteFill>
	);
};
