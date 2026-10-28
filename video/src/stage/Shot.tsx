/**
 * One figure card on stage, frameless: it dives out of its scene object, takes centre stage, recedes into depth,
 * and docks back into its object.
 * Local: a pose (x, y, scale, perspective tilt, opacity, blur) is blended from four targets by the shot's
 * emerge / rank / dock numbers (shots.ts) and its anchor (anchors.ts). The content is laid out at a native width
 * of 600 px and scaled as one vector picture:
 *  - kinetic title, the body (a card component from ../vignettes), and its caption;
 *  - a lower third "FIG. n · badge · citation";
 *  - a soft radial darkening behind it for legibility, instead of a box.
 * Global: drawn by StageLayer; replaces the boxed cards of v1.3.0 so examples live inside the scenes.
 * Sources: CSS 3D transforms https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/rotateY
 */
import React from 'react'; // JSX
import type {Timeline} from '../lib/timeline'; // data
import {BADGE_COLORS, COLORS, FONTS, glow, smooth} from '../lib/theme'; // look
import {VIGNETTES, FALLBACK} from '../vignettes'; // card bodies
import type {Anchor} from './anchors'; // dive origin + dock
import type {Shot as ShotState} from './shots'; // lifecycle numbers

export const NATIVE_W = 600; // layout width before scaling
export const BODY_H = 250; // body height before scaling
type Pose = {x: number; y: number; s: number; rot: number; op: number; blur: number};
const mix = (a: Pose, b: Pose, k: number): Pose => ({x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, s: a.s + (b.s - a.s) * k,
	rot: a.rot + (b.rot - a.rot) * k, op: a.op + (b.op - a.op) * k, blur: a.blur + (b.blur - a.blur) * k}); // linear blend
const HERO: Pose = {x: 960, y: 486, s: 1.8, rot: 0, op: 1, blur: 0}; // centre stage, about 1080 x 680 px (35 % of the frame)
const HERO_BIG: Pose = {x: 960, y: 368, s: 1.38, rot: 0, op: 1, blur: 0}; // upper two-thirds when giant lyrics take the lower third
const CORNERS = [[300, 240], [1620, 240], [300, 700], [1620, 700]]; // where receded cards orbit
const CORNERS_BIG = [[300, 210], [1620, 210], [170, 470], [1750, 470]]; // clear of the giant lyrics

/** Local: blended pose of a shot. Global: where and how big the card is drawn this frame. */
export const poseOf = (shot: ShotState, anchor: Anchor, big: boolean): Pose => {
	const hero = big ? HERO_BIG : HERO;
	const [cx, cy] = (big ? CORNERS_BIG : CORNERS)[shot.fig % 4]; // each card keeps its own corner, so orbits never cross
	const back = Math.max(0, shot.rank - 1); // deeper than the first orbit
	const orbit: Pose = {x: 960 + (cx - 960) * (1 + 0.2 * back), y: (big ? 400 : 470) + (cy - (big ? 400 : 470)) * (1 + 0.2 * back),
		s: 0.5 * 0.72 ** back, rot: cx < 960 ? 18 : -18, op: Math.max(0, 0.8 - 0.25 * back), blur: 1 + back};
	const live = mix(hero, orbit, Math.min(1, shot.rank)); // hero -> orbit as newer cards arrive
	const origin: Pose = {x: anchor.x, y: anchor.y, s: 0.06, rot: 70, op: 0.3, blur: 2}; // inside its scene object
	const out = mix(origin, live, shot.emerge); // dive out of the object
	const dock: Pose = anchor.dock.kind === 'thumb'
		? {x: anchor.dock.x, y: anchor.dock.y, s: anchor.dock.s, rot: 0, op: 0.92, blur: 0} // back into the object, as a thumbnail
		: {x: out.x, y: out.y, s: out.s * 2.6, rot: 0, op: 0, blur: 6}; // fly past the camera
	return mix(out, dock, shot.dock);
};

const ACCENTS = [COLORS.cyan, COLORS.magenta, COLORS.violet, COLORS.lime, COLORS.amber]; // cycled per section

/** Local: one frameless card at its pose. Global: the concrete example inside the scene. */
export const Shot: React.FC<{tl: Timeline; shot: ShotState; anchor: Anchor; t: number; big: boolean; pulse: number}> = ({tl, shot, anchor, t, big, pulse}) => {
	const {v, fig} = shot;
	const pose = poseOf(shot, anchor, big);
	if (pose.op <= 0.01) return null;
	const entry = VIGNETTES[v.id] ?? FALLBACK; // body component
	const Body = entry.Body;
	const local = t - v.startS; // seconds since the card appeared
	const accent = tl.sections.find((s) => s.index === v.sectionIndex)?.kind.includes('final') ? COLORS.amber : ACCENTS[v.sectionIndex % ACCENTS.length];
	const words = 1 - smooth(shot.dock * 2); // text fades as it docks; the thumbnail keeps the picture
	const shown = Math.floor(local * 45); // kinetic title: characters typed in
	const slam = 1.12 - 0.12 * smooth(local / 0.25); // title lands with a small overshoot
	return (
		<div style={{position: 'absolute', left: pose.x, top: pose.y, width: NATIVE_W, opacity: pose.op, filter: pose.blur > 0.05 ? `blur(${pose.blur}px)` : undefined,
			transform: `translate(-50%, -50%) perspective(1400px) rotateY(${pose.rot}deg) scale(${pose.s})`, transformOrigin: 'center'}}>
			<div style={{position: 'absolute', inset: -70, background: `radial-gradient(closest-side, rgba(4,5,13,${0.86 * words + 0.5 * (1 - words)}), rgba(4,5,13,0))`}} />
			<div style={{position: 'relative', opacity: words, transform: `scale(${slam})`, transformOrigin: 'left bottom', marginBottom: 6,
				fontFamily: FONTS.display, fontWeight: 700, fontSize: 25, lineHeight: 1.12, color: COLORS.ink, textShadow: glow(accent, 0.55 + 0.25 * pulse)}}>
				{v.title.slice(0, shown)}<span style={{color: accent, opacity: shown < v.title.length ? 1 : 0}}>▍</span>
			</div>
			<div style={{position: 'relative', width: NATIVE_W, height: BODY_H, filter: `drop-shadow(0 0 ${6 + 6 * pulse}px ${accent}55)`}}>
				<Body v={v} tl={tl} t={t} local={local} p={Math.min(1, local / Math.max(0.5, v.endS - v.startS))} w={NATIVE_W} h={BODY_H} pulse={pulse} accent={accent} />
				<div style={{position: 'absolute', top: -2, right: 0, fontFamily: FONTS.display, fontSize: 13, color: accent, opacity: 1 - words * 0.6}}>FIG. {fig}</div>
			</div>
			<div style={{position: 'relative', opacity: words}}>
				{entry.showText !== false && v.text ? <div style={{fontFamily: FONTS.body, fontSize: 15, lineHeight: 1.3, color: COLORS.ink, marginTop: 6}}>{v.text}</div> : null}
				<div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, borderTop: `1px solid ${accent}88`, paddingTop: 4, fontFamily: FONTS.mono, fontSize: 11, color: COLORS.dim, whiteSpace: 'nowrap', overflow: 'hidden'}}>
					<span style={{color: COLORS.bg, background: BADGE_COLORS[v.badge], borderRadius: 7, padding: '1px 7px', textTransform: 'uppercase'}}>{v.badge}</span>
					<span style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>{v.cite}</span>
				</div>
			</div>
		</div>
	);
};
