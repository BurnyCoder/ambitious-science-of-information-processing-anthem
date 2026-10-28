/**
 * Bridge — the atlas of the mathematics of information processing.
 * Local: ~30 fields as stars on a slowly rotating sphere (projected to 2D); a star ignites
 * when its name is sung, the rest ignite at "every level, every scale"; each star links to
 * its 3 nearest neighbours once both are lit; "ONE SCIENCE OF INFORMATION" closes the scene. Each sung field's figure
 * (a formula card the scene draws itself) grows out of the star's own label into a plate with the formula, its meaning
 * and the citation, and shrinks back when its time is over; cards with no star (invariants, bounds, every level) take
 * the free corners. Every card leaves before "science" ([[clear]] in content/vignettes.toml), so the amber statement
 * stands alone, with the closing card ("the same unit, the bit...") as its own subtitle.
 * Global: the song's thesis: many lenses (linear algebra ... category theory) -> one atlas of
 * laws, invariants, bounds and mechanisms across biological and artificial systems.
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random} from 'remotion'; // layer + RNG
import {beatPulse, wordTime} from '../lib/timeline'; // timing
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {cardsOn} from '../stage/shots'; // the cards this scene draws itself
import {sceneLayout} from '../stage/layout'; // the bridge accent
import type {SceneProps} from './types'; // contract

export const FIELDS: [string, RegExp | null][] = [ // name, sung keyword (null = lit at "every level")
	['linear algebra', /linear/i], ['calculus', /calculus/i], ['probability', /probability/i], ['information theory', /information/i],
	['optimization', /optimization/i], ['dynamical systems', /dynamics/i], ['loss-landscape geometry', /geometry/i],
	['statistical mechanics', /statistical/i], ['random matrix theory', /random|matrices/i], ['singular learning theory', /singular/i],
	['symmetry · group theory', /symmetry/i], ['category theory', /categories/i], ['causality', /causality/i], ['compression · AIT', /compression/i],
	['neural tangent kernel', null], ['tensor programs · μP', null], ['spline theory', null], ['formal languages', null],
	['complexity theory', null], ['control theory', null], ['game theory', null], ['topology · TDA', null], ['free energy principle', null],
	['computational mechanics', null], ['causal abstraction', null], ['Kolmogorov complexity', null], ['scaling laws', null],
	['mechanistic interpretability', null], ['statistical learning theory', null], ['information geometry', null],
];

const FORMULAS: Record<string, string> = { // one iconic formula or object per lens, shown under its name when lit
	'linear algebra': 'W = UΣVᵀ', calculus: '∂L/∂θ', probability: 'p(x | θ)', 'information theory': 'H = −Σ p log p',
	optimization: 'θ ← θ − η∇L', 'dynamical systems': 'dθ/dt = −∇L', 'loss-landscape geometry': '∇²L', 'statistical mechanics': 'p ∝ e^(−E/T)',
	'random matrix theory': 'ρ_MP(λ)', 'singular learning theory': 'λ log n', 'symmetry · group theory': 'f(gx) = g f(x)', 'category theory': 'h∘f = k∘g',
	causality: 'P(y | do(x))', 'compression · AIT': 'K(x)', 'neural tangent kernel': 'Θ(x, x′)', 'tensor programs · μP': 'width-stable η',
	'spline theory': 'max-affine splines', 'formal languages': 'Dyck-k', 'complexity theory': 'TC⁰', 'control theory': 'ẋ = Ax + Bu',
	'game theory': 'Nash equilibrium', 'topology · TDA': 'β₀, β₁', 'free energy principle': 'F = E_q[log q − log p]', 'computational mechanics': 'ε-machine',
	'causal abstraction': 'τ: low → high', 'Kolmogorov complexity': 'K(x) ≤ |x| + c', 'scaling laws': 'L ∝ N^−α', 'mechanistic interpretability': 'features → circuits',
	'statistical learning theory': 'VC dimension', 'information geometry': 'F_ij = E[∂ᵢlog p ∂ⱼlog p]',
};

/** Local: Fibonacci-sphere positions of the fields (index permuted ×7 mod 30 so sung fields spread out). */
const SPHERE = FIELDS.map((_, f) => {
	const i = (f * 7) % FIELDS.length; // permute (7 coprime with 30) so sung fields spread over the sphere
	const y = 1 - (2 * (i + 0.5)) / FIELDS.length; // -1..1
	const r = Math.sqrt(1 - y * y); // ring radius at that height
	const phi = i * Math.PI * (3 - Math.sqrt(5)) + random(`a${i}`) * 0.3; // golden angle + jitter
	return [Math.cos(phi) * r, y, Math.sin(phi) * r] as [number, number, number];
});

const R = 0.62, CY = 400; // sphere size and centre: leaves the margins to the figures and the lower band to the statement
const STATEMENT_Y = 625; // top of ONE SCIENCE OF INFORMATION (layout.json protects this band)
/** Local: screen position, perspective scale and depth of field f's star, `local` seconds into the bridge.
 * Global: drawn here; stage/anchors.ts dives cards out of (and docks them next to) the same stars. */
export const projectStar = (f: number, local: number) => {
	const [x, y, z] = SPHERE[f];
	const rot = local * 0.12; // slow rotation about Y
	const xr = x * Math.cos(rot) + z * Math.sin(rot);
	const zr = -x * Math.sin(rot) + z * Math.cos(rot);
	const s = 1 / (1.9 - zr * 0.7); // perspective scale (front bigger)
	return {x: 960 + xr * 1050 * s * R, y: CY + y * 560 * s * R, s, front: zr}; // the sphere sits above the closing statement
};

export const AtlasScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t, local, length} = useSceneClock(section); // time
	const pulse = beatPulse(tl.beats, t); // beat kick
	const base = SPHERE; // fibonacci-sphere points: even coverage
	const pts = FIELDS.map((_, f) => projectStar(f, local)); // rotate + perspective project
	const levelAt = wordTime(tl, section, /level/i) ?? section.startS + 0.7 * length; // ignite the rest
	const lightT = FIELDS.map(([, re], i) => (re ? wordTime(tl, section, re) : null) ?? levelAt + (i % 8) * 0.12); // per star
	const lit = lightT.map((s) => smooth((t - s) / 0.3)); // 0..1
	const links = useMemo(() => base.flatMap((a, i) => base.map((b, j) => ({j, d: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])}))
		.filter(({j}) => j > i).sort((p, q) => p.d - q.d).slice(0, 3).map(({j}) => [i, j] as [number, number])), [base]); // 3-NN graph
	const oneAt = wordTime(tl, section, /science/i) ?? section.startS + 0.9 * length; // finale text
	const atlasAt = wordTime(tl, section, /atlas/i) ?? section.startS + 0.55 * length; // atlas tagline
	const dimNet = 1 - 0.6 * smooth((t - oneAt) / 0.4); // fade the network behind the closing statement
	const accent = sceneLayout('atlas').accent; // violet: amber is the statement's alone
	const on = cardsOn(tl.vignettes, section.index, t); // the formula cards this scene draws
	const starOf = (title: string) => FIELDS.findIndex(([, re]) => re !== null && re.test(title)); // field of a card
	const starred = tl.vignettes.filter((v) => v.sectionIndex === section.index && v.lane === 'scene' && starOf(v.title) >= 0); // star figures, in sung order
	const shrink = (v: typeof starred[number]) => { const n = starred[starred.indexOf(v) + 2]; return n ? smooth((t - n.startS) / 0.4) : 0; }; // at most two grown at once
	const chips = on.filter((c) => c.v.title !== 'One science of information').map((c) => ({...c, f: starOf(c.v.title)}))
		.map((c) => ({...c, on: c.f >= 0 ? c.on * (1 - shrink(c.v)) : c.on})).filter((c) => c.on > 0.01); // older stars shrink back to their labels
	const closing = on.find((c) => c.v.title === 'One science of information'); // the statement's subtitle
	const grown = FIELDS.map((_, i) => Math.max(0, ...chips.filter((c) => c.f === i).map((c) => c.on))); // label i grown into a figure
	const loose = chips.filter((c) => c.f < 0); // cards without a star: the free corners
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
					color: COLORS.ink, opacity: dimNet * lit[i] * (0.45 + 0.55 * (p.front + 1) / 2) * (1 - grown[i]), whiteSpace: 'nowrap', textShadow: glow(COLORS.amber, 0.25)}}>
					{FIELDS[i][0]}
					<div style={{fontFamily: FONTS.mono, fontWeight: 400, fontSize: 11 + 5 * p.s, color: COLORS.amber}}>{FORMULAS[FIELDS[i][0]]}</div>
				</div>
			))}
			{[...chips.filter((c) => c.f >= 0).map((c) => ({c, x: pts[c.f].x + 16, y: pts[c.f].y - 18})),
				...loose.map((c, j) => ({c, x: j % 2 ? 1500 : 30, y: 90 + 90 * Math.floor(j / 2)}))].map(({c, x, y}) => ( // the star's label grown into its figure
				<div key={c.v.startS} style={{position: 'absolute', left: Math.min(x, 1900 - 420), top: y, maxWidth: 420, padding: '8px 12px', borderRadius: 10, opacity: c.on * dimNet,
					background: 'rgba(6,8,22,0.82)', border: `1.5px solid ${accent}`, boxShadow: `0 0 18px ${accent}55`, transformOrigin: 'left top', transform: `scale(${0.7 + 0.3 * c.on})`}}>
					<div style={{fontFamily: FONTS.display, fontWeight: 700, fontSize: 18, color: COLORS.ink, textShadow: glow(accent, 0.5)}}>{c.v.title}</div>
					{c.v.text.split('\n').map((l, k) => <div key={k} style={{fontFamily: FONTS.mono, fontSize: k ? 12 : 16, color: k ? COLORS.dim : COLORS.ink, marginTop: 3}}>{l}</div>)}
					<div style={{fontFamily: FONTS.mono, fontSize: 10, color: COLORS.dim, marginTop: 4}}>{c.v.badge.toUpperCase()} · {c.v.cite}</div>
				</div>
			))}
			<div style={{position: 'absolute', top: 70, width: '100%', textAlign: 'center', fontFamily: FONTS.mono, fontSize: 18, color: COLORS.dim, opacity: smooth((t - atlasAt) / 0.5)}}>
				an atlas of laws · invariants · bounds · effective theories · mechanisms — at every level, every scale
			</div>
			<div style={{position: 'absolute', top: STATEMENT_Y, width: '100%', textAlign: 'center', fontFamily: FONTS.display, fontWeight: 900, fontSize: 84, color: COLORS.ink,
				textShadow: glow(COLORS.amber, 1.2), opacity: smooth((t - oneAt) / 0.4), transform: `scale(${1.2 - 0.2 * smooth((t - oneAt) / 0.4)})`}}>
				ONE SCIENCE OF INFORMATION
				{closing ? <div style={{fontFamily: FONTS.body, fontWeight: 600, fontSize: 26, color: COLORS.amber, textShadow: 'none', opacity: closing.on, marginTop: 4}}>
					{closing.v.text.split('\n')[0]}<span style={{fontFamily: FONTS.mono, fontSize: 14, color: COLORS.dim}}> · {closing.v.cite}</span>
				</div> : null}
			</div>
		</AbsoluteFill>
	);
};
