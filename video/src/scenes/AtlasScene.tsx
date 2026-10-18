/**
 * Bridge — the atlas of the mathematics of information processing.
 * Local: ~30 fields as stars on a slowly rotating sphere (projected to 2D); a star ignites
 * when its name is sung, the rest ignite at "every level, every scale"; each star links to
 * its 3 nearest neighbours once both are lit; "ONE SCIENCE OF INFORMATION" closes the scene.
 * Global: the song's thesis: many lenses (linear algebra ... category theory) -> one atlas of
 * laws, invariants, bounds and mechanisms across biological and artificial systems.
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random} from 'remotion'; // layer + RNG
import {beatPulse, wordTime} from '../lib/timeline'; // timing
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import type {SceneProps} from './types'; // contract

const FIELDS: [string, RegExp | null][] = [ // name, sung keyword (null = lit at "every level")
	['linear algebra', /linear/i], ['calculus', /calculus/i], ['probability', /probability/i], ['information theory', /information/i],
	['optimization', /optimization/i], ['dynamical systems', /dynamics/i], ['loss-landscape geometry', /geometry/i],
	['statistical mechanics', /statistical/i], ['random matrix theory', /random|matrices/i], ['singular learning theory', /singular/i],
	['symmetry · group theory', /symmetry/i], ['category theory', /categories/i], ['causality', /causality/i], ['compression · AIT', /compression/i],
	['neural tangent kernel', null], ['tensor programs · μP', null], ['spline theory', null], ['formal languages', null],
	['complexity theory', null], ['control theory', null], ['game theory', null], ['topology · TDA', null], ['free energy principle', null],
	['computational mechanics', null], ['causal abstraction', null], ['Kolmogorov complexity', null], ['scaling laws', null],
	['mechanistic interpretability', null], ['statistical learning theory', null], ['information geometry', null],
];

export const AtlasScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t, local, length} = useSceneClock(section); // time
	const pulse = beatPulse(tl.beats, t); // beat kick
	const base = useMemo(() => FIELDS.map((_, f) => { // fibonacci-sphere points: even coverage
		const i = (f * 7) % FIELDS.length; // permute (7 coprime with 30) so sung fields spread over the sphere
		const y = 1 - (2 * (i + 0.5)) / FIELDS.length; // -1..1
		const r = Math.sqrt(1 - y * y); // ring radius at that height
		const phi = i * Math.PI * (3 - Math.sqrt(5)) + random(`a${i}`) * 0.3; // golden angle + jitter
		return [Math.cos(phi) * r, y, Math.sin(phi) * r] as [number, number, number];
	}), []);
	const rot = local * 0.12; // slow rotation about Y
	const pts = base.map(([x, y, z]) => { // rotate + perspective project
		const xr = x * Math.cos(rot) + z * Math.sin(rot);
		const zr = -x * Math.sin(rot) + z * Math.cos(rot);
		const s = 1 / (1.9 - zr * 0.7); // perspective scale (front bigger)
		return {x: 960 + xr * 1050 * s, y: 540 + y * 560 * s, s, front: zr}; // fits between caption and lyrics
	});
	const levelAt = wordTime(tl, section, /level/i) ?? section.startS + 0.7 * length; // ignite the rest
	const lightT = FIELDS.map(([, re], i) => (re ? wordTime(tl, section, re) : null) ?? levelAt + (i % 8) * 0.12); // per star
	const lit = lightT.map((s) => smooth((t - s) / 0.3)); // 0..1
	const links = useMemo(() => base.flatMap((a, i) => base.map((b, j) => ({j, d: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])}))
		.filter(({j}) => j > i).sort((p, q) => p.d - q.d).slice(0, 3).map(({j}) => [i, j] as [number, number])), [base]); // 3-NN graph
	const oneAt = wordTime(tl, section, /science/i) ?? section.startS + 0.9 * length; // finale text
	const atlasAt = wordTime(tl, section, /atlas/i) ?? section.startS + 0.55 * length; // atlas tagline
	const dimNet = 1 - 0.6 * smooth((t - oneAt) / 0.4); // fade the network behind the closing statement
	return (
		<AbsoluteFill>
			<svg width={1920} height={1080} style={{position: 'absolute', opacity: dimNet}}>
				{links.map(([i, j], k) => <line key={k} x1={pts[i].x} y1={pts[i].y} x2={pts[j].x} y2={pts[j].y} stroke={COLORS.cyan} strokeWidth={2}
					opacity={0.6 * Math.min(lit[i], lit[j])} />)}
				{pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={(4 + 8 * lit[i] * (1 + 0.4 * pulse)) * p.s * 1.4}
					fill={lit[i] > 0.5 ? COLORS.amber : COLORS.violet} opacity={0.3 + 0.7 * lit[i]} />)}
			</svg>
			{pts.map((p, i) => (
				<div key={i} style={{position: 'absolute', left: p.x + 14, top: p.y - 14, fontFamily: FONTS.body, fontWeight: 600, fontSize: 15 + 10 * p.s,
					color: COLORS.ink, opacity: dimNet * lit[i] * (0.45 + 0.55 * (p.front + 1) / 2), whiteSpace: 'nowrap', textShadow: glow(COLORS.amber, 0.25)}}>
					{FIELDS[i][0]}
				</div>
			))}
			<div style={{position: 'absolute', top: 110, width: '100%', textAlign: 'center', fontFamily: FONTS.mono, fontSize: 26, color: COLORS.dim, opacity: smooth((t - atlasAt) / 0.5)}}>
				an atlas of laws · invariants · bounds · effective theories · mechanisms — at every level, every scale
			</div>
			<div style={{position: 'absolute', top: 470, width: '100%', textAlign: 'center', fontFamily: FONTS.display, fontWeight: 900, fontSize: 84, color: COLORS.ink,
				textShadow: glow(COLORS.amber, 1.2), opacity: smooth((t - oneAt) / 0.4), transform: `scale(${1.2 - 0.2 * smooth((t - oneAt) / 0.4)})`}}>
				ONE SCIENCE OF INFORMATION
			</div>
		</AbsoluteFill>
	);
};
