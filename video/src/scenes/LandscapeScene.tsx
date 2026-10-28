/**
 * Pre-chorus 1 — gradient descent through a non-convex landscape into flat minima.
 * Local: a toy 2D loss surface (one wide basin, one sharp narrow basin, saddles, ripples)
 * drawn as a height-colored point lattice; 28 noisy-gradient-descent particles, whose
 * trajectories are precomputed deterministically, descend with glowing trails. Concrete layers on the same surface:
 *  - "saddle": the surface's own saddle between the basins (found by Newton's method) sprouts its two Hessian
 *    eigen-axes and eigen-bars, labelled with the computed eigenvalues;
 *  - "flat": both minima are shaken by ±ρ; the live ΔL and λmax show why the wide one is "flat" (SAM's sharpness);
 *  - "generalize": the released grokking train/test curves and the double-descent curve rise as glowing ribbons
 *    as glowing ribbons on two walls standing at the sides of the surface;
 *  - "inside": the camera dives into the particle that reached the wide basin, and the dive ends in the
 *    curve-detector tiles (a card the scene draws itself).
 * The figure panels sit in the side slots (stage/layout.json), wired to the surface point each explains
 * (landscapeAnchor); the labels sit on their 3D points, since nothing covers the centre.
 * Global: illustrates the lyric "past every saddle, to valleys flat and wide"; the flat-minima
 * <-> generalization link is the hypothesis of Hochreiter & Schmidhuber (1997, Neural Computation
 * "Flat Minima") and Keskar et al. (2017, ICLR, arXiv:1609.04836). This surface is illustrative only;
 * the numbers on it are computed from it, the ribbons are released data (Nanda et al. 2023; Nakkiran et al. 2019).
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random} from 'remotion'; // layer + seeded RNG
import {beatPulse, wordTime} from '../lib/timeline'; // beat kick + lyric triggers
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {criticalPoint, hessian2, sym2Eig} from '../lib/mathviz'; // Newton + Hessian eigen-decomposition
import {CameraRig, GlowLines, GlowPoints, Stage, projectToScreen, rgb} from '../components/three'; // 3D blocks
import grok from '../../public/vignettes/grokking.json'; // Nanda et al. mainline run (train/test loss per epoch)
import dd from '../../public/vignettes/double_descent.json'; // Nakkiran et al. ResNet18 width sweep
import {cardsOn} from '../stage/shots'; // the cards this scene draws itself
import {VIGNETTES} from '../vignettes'; // their bodies
import type {SceneProps} from './types'; // contract

const N = 90; // lattice resolution per side
const SPAN = 24; // world size of the surface
const RUNS = 28; // SGD particles
const STEPS = 400; // optimizer steps per particle
const TRAIL = 30; // trail length in steps
const LR = 0.5; // learning rate η (below 2/curvature of the sharp basin)
const RHO = 0.8; // perturbation radius ρ, as in SAM's sharpness max_{‖ε‖≤ρ} L(w+ε) − L(w) (Foret et al. 2021, arXiv:2010.01412)
const FOV = 50; // camera field of view (shared with the label projection)

/** Local: toy loss L(x, y). Global: same function for surface heights, gradients, critical points and labels. */
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

/** Local: the surface's own critical points (Newton from nearby seeds), so every label is computed from L. */
const critical = (seed: [number, number], what: string): [number, number] => { // fail loudly if the surface was edited
	const p = criticalPoint(loss, seed);
	if (!p) throw new Error(`LandscapeScene: Newton's method found no ${what} near ${seed}; update the seed after editing loss()`);
	return p;
};
const SADDLE = critical([-3.7, -2.3], 'saddle'); // the saddle on the path between the two basins
const WIDE = critical([4.8, 1.5], 'wide minimum'); // wide basin minimum
const SHARP = critical([-5.9, -4.9], 'sharp minimum'); // sharp basin minimum
const EIG = sym2Eig(hessian2(loss, ...SADDLE)); // one negative (escape) and one positive eigenvalue
const lmax = (p: [number, number]) => sym2Eig(hessian2(loss, ...p)).values[1]; // largest curvature at a minimum
const BASINS = [{p: SHARP, name: 'sharp', color: COLORS.magenta, l: lmax(SHARP)}, {p: WIDE, name: 'flat', color: COLORS.lime, l: lmax(WIDE)}];
const surf = (x: number, y: number, lift = 0.15): [number, number, number] => [x, loss(x, y) * 2 + lift, y]; // world point on the surface (x2 height)

/** Local: a polyline as segment pairs, drawn `n` times with a small vertical offset so it reads as a ribbon. */
const ribbon = (pts: [number, number, number][], color: string, k: number) => {
	const p: number[] = [], c: number[] = [];
	for (const dy of [-0.07, 0, 0.07]) for (let i = 1; i < pts.length; i++) {
		p.push(pts[i - 1][0], pts[i - 1][1] + dy, pts[i - 1][2], pts[i][0], pts[i][1] + dy, pts[i][2]);
		c.push(...rgb(color, k), ...rgb(color, k));
	}
	return {p, c};
};
const EPOCHS = Math.log10(Math.max(...grok.train.map(([e]) => e), ...grok.test.map(([e]) => e)) + 1); // log10 of the last epoch
const WALL = 12.5; // the ribbon walls stand at x = ±WALL, from z = 6 (near the camera) to z = −10 (far)
const zAt = (f: number) => 6 - 16 * f; // fraction along the wall -> world z
const grokPts = (s: number[][]) => s.map(([e, l]) => [-WALL, 7.2 + 0.5 * Math.log10(Math.max(l, 1e-9)), zAt(Math.log10(e + 1) / EPOCHS)] as [number, number, number]); // log-log; reads left -> right
const ddPts = (v: number[]) => v.map((y, i) => [WALL, 3.6 + 9 * y, zAt(1 - (dd.k[i] - 1) / (dd.k[dd.k.length - 1] - 1))] as [number, number, number]); // linear width k; reads left -> right
const RIBBONS = [ // `tag`: index of the point that carries the label
	{pts: grokPts(grok.train), color: COLORS.cyan, label: 'train', at: 0, tag: 0.45},
	{pts: grokPts(grok.test), color: COLORS.magenta, label: 'test', at: 0, tag: 0.45},
	{pts: ddPts(dd.trainMean), color: COLORS.cyan, label: 'train', at: 0.8, tag: 1},
	{pts: ddPts(dd.testMean), color: COLORS.amber, label: 'test', at: 0.8, tag: 1},
];

/** Local: the orbit camera at `local` seconds and `progress` 0..1 of the section (before the dive). Global: shared by the
 * scene and landscapeAnchor, so panels are wired to where the surface points are actually drawn. */
const orbitCam = (local: number, progress: number): [number, number, number] => {
	const theta = 0.6 + local * 0.08; // slow orbit
	return [Math.cos(theta) * 26, 15 - progress * 4, Math.sin(theta) * 26];
};
/** Local: screen point a pre-chorus-1 figure is wired to: the saddle, the wide basin, a ribbon wall, or the surface
 * centre. Global: stage/anchors.ts. */
export const landscapeAnchor = (id: string, local: number, progress: number) => {
	const p: [number, number, number] = id === 'saddle' ? surf(...SADDLE, 0.3) : id === 'flat' ? surf(...WIDE, 0.35)
		: id === 'grokking' ? [-WALL, 8, -2] : id === 'doubleDescent' ? [WALL, 7, -2] : surf(0, 0, 0.3);
	return projectToScreen(p, orbitCam(local, progress), [0, 1, 0], FOV);
};

export const LandscapeScene: React.FC<SceneProps> = ({tl, section}) => {
	const {frame, t, local, progress} = useSceneClock(section); // time
	const pulse = beatPulse(tl.beats, t); // beat kick
	const at = (re: RegExp, frac: number) => wordTime(tl, section, re) ?? section.startS + frac * (section.endS - section.startS); // lyric trigger
	const saddle = smooth((t - at(/saddle/i, 0.3)) / 0.7); // eigen-axes grow
	const flatAt = at(/flat/i, 0.4); // "flat" sung
	const flat = smooth((t - flatAt) / 0.5); // basins shake
	const gen = at(/generalize/i, 0.55); // ribbons draw from here
	const insideAt = tl.vignettes.find((v) => v.sectionIndex === section.index && v.id === 'curves')?.startS ?? at(/inside/i, 0.85); // "So we go inside!": the dive starts with its card
	const dive = smooth((t - insideAt) / Math.max(0.5, section.endS - insideAt)); // camera dive into the winning particle
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
	const diver = useMemo(() => runs.reduce((b, p, r) => { // the particle that ends closest to the wide minimum
		const d = (q: [number, number, number][]) => Math.hypot(q[STEPS - 1][0] - WIDE[0], q[STEPS - 1][2] - WIDE[1]);
		return d(p) < d(runs[b]) ? r : b;
	}, 0), [runs]);
	const step = Math.min(STEPS - 1, Math.floor(Math.pow(progress, 0.8) * STEPS)); // ease: fast start, settle
	const {ppos, pcol, tpos, tcol} = useMemo(() => { // per-frame particle + trail arrays
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
	const shake = local * 5; // direction angle φ of the ±ρ perturbation
	const probes = BASINS.map((b) => { // perturbed point ε = ρ(cos φ, sin φ) on each basin
		const q: [number, number] = [b.p[0] + RHO * flat * Math.cos(shake), b.p[1] + RHO * flat * Math.sin(shake)];
		return {...b, q, dL: loss(...q) - loss(...b.p)};
	});
	const extras = useMemo(() => { // eigen-axes, eigen-bars, shake rings, ribbons (segment pairs)
		const p: number[] = [], c: number[] = [];
		const add = (r: {p: number[]; c: number[]}) => { p.push(...r.p); c.push(...r.c); };
		EIG.vectors.forEach((v, i) => { // the two Hessian eigen-directions, following the surface
			const len = 3.5 * saddle, col = EIG.values[i] < 0 ? COLORS.magenta : COLORS.cyan;
			add(ribbon(Array.from({length: 25}, (_, k) => surf(SADDLE[0] + (k / 12 - 1) * len * v[0], SADDLE[1] + (k / 12 - 1) * len * v[1], 0.3)), col, 1.6));
			const [x, y, z] = surf(SADDLE[0] + 0.25 * (i * 2 - 1), SADDLE[1], 0.2); // eigen-bar: height ∝ |λ|
			for (const dx of [-0.08, 0, 0.08]) { p.push(x + dx, y, z, x + dx, y + 5 * Math.abs(EIG.values[i]) * saddle, z); c.push(...rgb(col, 1.8), ...rgb(col, 1.8)); }
		});
		probes.forEach((b) => { if (flat > 0) add(ribbon(Array.from({length: 33}, (_, k) => surf(b.p[0] + RHO * Math.cos(k * Math.PI / 16), b.p[1] + RHO * Math.sin(k * Math.PI / 16), 0.25)), b.color, 1.2)); }); // ‖ε‖ = ρ ring
		RIBBONS.forEach((r) => { const d = smooth((t - gen - r.at) / 1.6); if (d > 0) add(ribbon(r.pts.slice(0, Math.max(2, Math.ceil(d * r.pts.length))), r.color, 1.5)); });
		return {p: new Float32Array(p), c: new Float32Array(c)};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [frame]);
	const ball = new Float32Array(probes.flatMap((b) => surf(...b.q, 0.35))); // the shaken weights
	const ballCol = new Float32Array(probes.flatMap((b) => rgb(b.color, 1.8 + pulse)));
	const head = runs[diver][step]; // the diver's current position
	const orbit = orbitCam(local, progress); // before the dive
	const cam = orbit.map((o, i) => o + (head[i] + [0, 2.2, 3.2][i] - o) * dive) as [number, number, number]; // dive toward the particle
	const target = [0, 1, 0].map((o, i) => o + (head[i] - o) * dive) as [number, number, number];
	const proj = (p: [number, number, number]) => projectToScreen(p, cam, target, FOV); // 3D -> pixel
	const live = (from: number, to: number) => smooth((t - from) / 0.5) * (1 - smooth((t - to) / 0.5)); // a callout's lifetime
	/** Local: a label on its 3D point, on the side facing the centre (the side slots hold the figure panels). */
	const callout = (key: string, p: [number, number, number], op: number, lines: [string, string][]) => {
		const q = proj(p);
		if (op <= 0 || !q.visible) return null;
		const right = q.x < 960, x = q.x + (right ? 18 : -18); // text towards the centre
		return (
			<g key={key} opacity={op}>
				<circle cx={q.x} cy={q.y} r={6} fill={lines[0][1]} />
				<rect x={right ? x - 6 : x - 300} y={q.y - 22} width={306} height={lines.length * 22 + 12} rx={8} fill="rgba(6,8,22,0.62)" />
				{lines.map(([txt, col], i) => <text key={i} x={x} y={q.y - 4 + i * 22} fill={col} fontFamily={FONTS.mono} fontSize={17} textAnchor={right ? 'start' : 'end'}
					style={{textShadow: glow(col, 0.4)}}>{txt}</text>)}
			</g>
		);
	};
	const tiles = cardsOn(tl.vignettes, section.index, t).find((c) => c.v.id === 'curves'); // the dive's destination
	const Tiles = VIGNETTES.curves?.Body;
	const ribbonOp = (k: number) => smooth((t - gen - k) / 0.5) * (1 - dive);
	const tagAt = (r: (typeof RIBBONS)[number]) => proj(r.pts[Math.round(r.tag * (r.pts.length - 1))]);
	return (
		<AbsoluteFill>
			<Stage fov={FOV}>
				<CameraRig position={cam} target={target} />
				<GlowPoints positions={surface.pos} colors={surface.col} size={0.22} opacity={0.9} />
				<GlowLines positions={tpos} colors={tcol} opacity={0.9} />
				<GlowLines positions={extras.p} colors={extras.c} opacity={0.95} />
				<GlowPoints positions={ppos} colors={pcol} size={0.9 + 0.3 * pulse} />
				<GlowPoints positions={ball} colors={ballCol} size={1.3 * flat} />
			</Stage>
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				{callout('saddle', surf(SADDLE[0], SADDLE[1], 0.3), live(at(/saddle/i, 0.3), gen) * (1 - dive), [
					['saddle of this surface', COLORS.ink], ['∇L = 0 (Newton)', COLORS.dim],
					[`Hessian λ₁ = ${EIG.values[0].toFixed(2)}`, COLORS.magenta], [`        λ₂ = +${EIG.values[1].toFixed(2)}`, COLORS.cyan]])}
				{probes.map((b) => callout(b.name, surf(...b.p, 0.35), live(flatAt, insideAt) * (1 - dive), [
					[`${b.name} minimum`, b.color], [`λmax = ${b.l.toFixed(2)}`, COLORS.ink], [`shake ‖ε‖ = ρ = ${RHO}`, COLORS.dim],
					[`ΔL = ${b.dL >= 0 ? '+' : ''}${b.dL.toFixed(2)}`, b.color]]))}
				{RIBBONS.map((r, i) => { const q = tagAt(r); return q.visible ? (
					<text key={i} x={q.x + (i < 2 ? -10 : 10)} y={q.y + (r.label === 'test' ? -10 : 22)} fill={r.color} fontFamily={FONTS.mono} fontSize={16} textAnchor={i < 2 ? 'end' : 'start'}
						opacity={ribbonOp(r.at + 1.2)} style={{textShadow: glow(r.color, 0.4)}}>{r.label}</text>) : null; })}
				{[[`grokking · mod ${grok.config.p}`, 'Nanda et al. 2023 · log epochs', -WALL, 0], ['double descent · width k', 'Nakkiran et al. 2019 · test error', WALL, 0.8]].map(([a, b, x, k]) => {
					const q = proj([x as number, 9.4, 6]);
					return q.visible ? <g key={a as string} opacity={ribbonOp(k as number)}>
						<text x={Math.min(1810, Math.max(110, q.x))} y={q.y} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={17} textAnchor={(x as number) < 0 ? 'start' : 'end'}>{a}</text>
						<text x={Math.min(1810, Math.max(110, q.x))} y={q.y + 22} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={14} textAnchor={(x as number) < 0 ? 'start' : 'end'}>{b}</text></g> : null; })}
			</svg>
			{tiles && Tiles ? <div style={{position: 'absolute', left: 960 - 300, top: 470 - 125, width: 600, height: 250, opacity: tiles.on * dive,
				transform: `scale(${0.3 + 1.5 * dive})`}}> {/* the dive lands in the curve-detector tiles */}
				<Tiles v={tiles.v} tl={tl} t={t} local={t - tiles.v.startS} p={dive} w={600} h={250} pulse={pulse} accent={COLORS.violet} />
			</div> : null}
		</AbsoluteFill>
	);
};
