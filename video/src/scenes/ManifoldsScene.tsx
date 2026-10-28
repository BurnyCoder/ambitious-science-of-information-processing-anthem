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
import {CameraRig, GlowLines, GlowPoints, Stage, projectToScreen, rgb} from '../components/three'; // 3D blocks
import {COLORS as C, FONTS, glow} from '../lib/theme'; // labels
import antonyms from '../../public/vignettes/antonyms.json'; // Todd et al. antonym pairs
import world from '../../public/vignettes/world.json'; // [lon, lat] of real places
import type {SceneProps} from './types'; // contract

const PER = 700; // points per schematic manifold
/** Local: screen x of the ring, the helix and the globe (camera at z = 19, fov 50). Global: stage/anchors.ts. */
export const MANIFOLD_X = [472, 960, 1448];
/** Local: which manifold each card dives out of. Global: stage/anchors.ts (other cards: by order). */
export const MANIFOLD_OF: Record<string, number> = {superposition: 0, polysemantic: 0, bsf: 1, functionVector: 1, truth: 1, worldMap: 2, probeR2: 2, formula: 2};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; // the ring's 12 clusters
const SCALES: [string, number][] = [['Llama-2-7B', 0.881], ['Llama-2-13B', 0.896], ['Llama-2-70B', 0.911]]; // Gurnee & Tegmark Table 2, world R²
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
	const noiseAt = wordTime(tl, section, /noise/i) ?? section.startS + 1; // superposition pentagon appears
	const truthAt = wordTime(tl, section, /thought/i) ?? section.startS + 7; // the truth split
	const biggerAt = wordTime(tl, section, /bigger/i) ?? section.startS + 0.6 * (section.endS - section.startS); // scale steps begin
	const step = Math.min(2, Math.max(0, Math.floor((t - biggerAt) / 1.3))); // 7B -> 13B -> 70B
	const truth = smooth((t - truthAt) / 0.6); // 0..1
	const counts = [PER, PER, world.places.length]; // points per manifold
	const {pos, col} = useMemo(() => {
		const blur = t < biggerAt ? 1.6 * Math.pow(1 - progress, 1.5) + 0.04 : 1.2 * Math.sqrt(1 - SCALES[step][1]) + 0.04; // then steps with the published R² (illustrative)
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
				const side = m === 1 && truth > 0 ? (x > 0 ? COLORS.lime : COLORS.magenta) : colors[m]; // helix splits into true / false
				col.set(rgb(side, 0.5 + 0.6 * (1 - blur / 1.64) + 0.3 * pulse), i); // crisper = brighter
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
	const cam: [number, number, number] = [0, 2.5, 19 - progress * 3]; // camera, shared with the label projection
	const pent = smooth((t - noiseAt) / 0.6); // superposition: 5 features in the ring's 2D plane, a pentagon
	const pentagon = useMemo(() => {
		const p: number[] = [];
		const c: number[] = [];
		for (let i = 0; i < 5; i++) {
			const a = Math.PI / 2 + (i * 2 * Math.PI) / 5;
			p.push(-8, 0, 0, -8 + 2.4 * pent * Math.cos(a), 2.4 * pent * Math.sin(a), 0);
			c.push(...rgb(COLORS.amber, 1.4), ...rgb(COLORS.amber, 1.4));
		}
		return {p: new Float32Array(p), c: new Float32Array(c)};
	}, [pent]);
	const ringLabels = MONTHS.map((mo, i) => { // month labels on the ring's clusters, spinning with it
		const a = (i / 12) * Math.PI * 2, rot = local * 0.35;
		const x = Math.cos(a) * 3.6, z = 0;
		return {mo, ...projectToScreen([-8 + x * Math.cos(rot) + z * Math.sin(rot), Math.sin(a) * 3.6, -x * Math.sin(rot) + z * Math.cos(rot)], cam, [0, 0, 0], 50)};
	});
	const pair = antonyms[Math.floor(Math.max(0, t - fvAt) / 0.7) % antonyms.length]; // antonym pairs streaming along the function vector
	const tip = projectToScreen([-8 + 4.5 * fv, 3.5 * fv, 2 * fv], cam, [0, 0, 0], 50);
	return (
		<AbsoluteFill>
			<Stage fov={50}>
				<CameraRig position={cam} target={[0, 0, 0]} />
				<GlowLines positions={pentagon.p} colors={pentagon.c} opacity={pent} />
				<GlowPoints positions={pos} colors={col} size={0.26} />
				<GlowLines positions={arrow.p} colors={arrow.c} opacity={fv} />
			</Stage>
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				{ringLabels.map((l) => <text key={l.mo} x={l.x} y={l.y} fill={C.ink} fontFamily={FONTS.mono} fontSize={15} textAnchor="middle" opacity={0.75 * (1 - pent * 0.4)}>{l.mo}</text>)}
				{[['1900', 0.95], ['1950', 0.6], ['2000', 0.25], ['2050', -0.1]].map(([yr, h]) => { const q = projectToScreen([2.3, (h as number) * 3.5, 0], cam, [0, 0, 0], 50);
					return <text key={yr as string} x={q.x} y={q.y} fill={C.ink} fontFamily={FONTS.mono} fontSize={15} opacity={0.7}>{yr as string}</text>; })}
				<text x={tip.x + 14} y={tip.y - 8} fill={C.amber} fontFamily={FONTS.mono} fontSize={22} opacity={fv} style={{textShadow: glow(C.amber, 0.4)}}>{pair.input} + v → {pair.output}</text>
				<text x={960} y={190} fill={C.lime} fontFamily={FONTS.mono} fontSize={18} textAnchor="middle" opacity={truth}>true | false</text>
				<text x={1448} y={230} fill={C.ink} fontFamily={FONTS.display} fontSize={22} textAnchor="middle" opacity={smooth((t - biggerAt) / 0.4)} style={{textShadow: glow(C.lime, 0.5)}}>
					{SCALES[step][0]} · probe R² {SCALES[step][1].toFixed(3)}
				</text>
			</svg>
		</AbsoluteFill>
	);
};
