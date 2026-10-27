/**
 * Pre-chorus 2 — "structure everywhere ... geometry that mirrors the world ... the bigger they get, the crisper".
 * Local: three feature geometries as point clouds that start blurred and sharpen over the section (stand-in for
 * model scale): a 12-cluster ring (cyclic concepts such as months), a helix (ordered concepts such as years) and a
 * globe of 900 real places (Gurnee & Tegmark's dataset, lat/lon -> sphere), plus a "function vector" arrow when
 * that phrase is sung. The concrete cards (superposition, Goodfire BSF, antonym function vector, world map, probe
 * R²) are drawn by the illustration track in the corners.
 * Global: grounded in circular features (Engels et al. 2024, arXiv:2405.14860), space/time probes sharper in larger
 * models (Gurnee & Tegmark 2023, arXiv:2310.02207), function vectors (Todd et al. 2023, arXiv:2310.15213).
 * Ring and helix geometry here are schematic; the globe's points are real coordinates.
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random} from 'remotion'; // layer + RNG
import {beatPulse, wordTime} from '../lib/timeline'; // timing
import {COLORS, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {CameraRig, GlowLines, GlowPoints, Stage, rgb} from '../components/three'; // 3D blocks
import world from '../../public/vignettes/world.json'; // [lon, lat] of real places
import type {SceneProps} from './types'; // contract

const PER = 700; // points per schematic manifold

/** Local: clean sample k of manifold m (0 ring, 1 helix, 2 globe), in its own frame. Global: the geometry the noise hides. */
const sample = (m: number, k: number): [number, number, number] => {
	const u = k / PER; // 0..1 along the manifold
	if (m === 0) { const a = Math.round(u * 12) / 12 * Math.PI * 2; return [Math.cos(a) * 3, Math.sin(a) * 3, 0]; } // 12 clusters on a circle
	if (m === 1) { const a = u * Math.PI * 6; return [Math.cos(a) * 1.6, (u - 0.5) * 7, Math.sin(a) * 1.6]; } // helix
	const [lon, lat] = world.places[k % world.places.length]; // real place
	const th = (lat * Math.PI) / 180, ph = (lon * Math.PI) / 180; // degrees -> radians
	return [Math.cos(th) * Math.sin(ph) * 2.6, Math.sin(th) * 2.6, Math.cos(th) * Math.cos(ph) * 2.6]; // on a sphere of radius 2.6
};

export const ManifoldsScene: React.FC<SceneProps> = ({tl, section}) => {
	const {frame, t, local, progress} = useSceneClock(section); // time
	const pulse = beatPulse(tl.beats, t); // beat kick
	const fvAt = wordTime(tl, section, /function/i) ?? section.startS + 4; // "function vectors" sung
	const counts = [PER, PER, world.places.length]; // points per manifold
	const {pos, col} = useMemo(() => {
		const blur = 1.6 * Math.pow(1 - progress, 1.5) + 0.04; // noise shrinks: "crisper" with scale
		const n = counts.reduce((a, b) => a + b, 0);
		const pos = new Float32Array(n * 3);
		const col = new Float32Array(n * 3);
		const centers: [number, number, number][] = [[-8, 0, 0], [0, 0, 0], [8, 0, 0]]; // three manifolds side by side
		const colors = [COLORS.cyan, COLORS.magenta, COLORS.lime];
		let i = 0; // write cursor
		for (let m = 0; m < 3; m++) {
			const rot = local * (0.35 + 0.1 * m); // each spins at its own rate
			for (let k = 0; k < counts[m]; k++, i += 3) {
				const [x, y, z] = sample(m, k); // clean point
				const e = [0, 1, 2].map((d) => (random(`n${m}-${k}-${d}`) - 0.5) * 2 * blur); // fixed noise direction, shrinking
				const xr = (x + e[0]) * Math.cos(rot) + (z + e[2]) * Math.sin(rot); // rotate about Y
				const zr = -(x + e[0]) * Math.sin(rot) + (z + e[2]) * Math.cos(rot);
				pos.set([centers[m][0] + xr, centers[m][1] + y + e[1], centers[m][2] + zr], i);
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
				<GlowPoints positions={pos} colors={col} size={0.26} />
				<GlowLines positions={arrow.p} colors={arrow.c} opacity={fv} />
			</Stage>
		</AbsoluteFill>
	);
};
