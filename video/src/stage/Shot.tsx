/**
 * One figure card: its face (shared by panels and by scenes that draw their own cards), and a panel that flies out of
 * its scene object into the scene's slot, stays there, and docks back.
 * Local:
 *  - CardFace: kinetic title, the body (a card component from ../vignettes) at 600 x 250, caption and a lower third
 *    "FIG. n · badge · citation", laid out at the native card width;
 *  - poseOf: centre, scale and opacity blended from the anchor (the object), the slot (stage/layout.json) and the dock;
 *  - Panel: the face on a plate in the scene's accent (no full-frame backdrop, no dimming of the scene).
 * Global: drawn by StageLayer (panels, lanes a/b) and by scenes for their "scene" cards (CardFace). Replaces v1.4.0's
 * centre hero over a pushed-in, dimmed scene, which made the figures read as a second video on top of the first.
 * Sources: CSS transforms https://developer.mozilla.org/en-US/docs/Web/CSS/transform
 */
import React from 'react'; // JSX
import type {Timeline, Vignette} from '../lib/timeline'; // data
import {BADGE_COLORS, COLORS, FONTS, glow, smooth} from '../lib/theme'; // look
import {VIGNETTES, FALLBACK} from '../vignettes'; // card bodies
import type {Anchor} from './anchors'; // dive origin + dock
import {CARD, fit, type Rect} from './layout'; // native card size + slot fitting
import type {Shot} from './shots'; // lifecycle numbers

export const BODY_H = 250; // body height inside the 600 x 350 card (title, caption and lower third take the rest)

/** Local: a card's content at the native width: typed title, body, caption, lower third; `words` fades the text.
 * Global: the face of every figure, wherever it is drawn. */
export const CardFace: React.FC<{tl: Timeline; v: Vignette; t: number; accent: string; pulse: number; fig?: number; words?: number}> =
	({tl, v, t, accent, pulse, fig, words = 1}) => {
		const entry = VIGNETTES[v.id] ?? FALLBACK; // body component
		const Body = entry.Body;
		const local = t - v.startS; // seconds since the card appeared
		const shown = Math.floor(local * 45); // kinetic title: characters typed in
		return (
			<div style={{width: CARD.w}}>
				<div style={{opacity: words, marginBottom: 6, fontFamily: FONTS.display, fontWeight: 700, fontSize: 25, lineHeight: 1.12, color: COLORS.ink,
					textShadow: glow(accent, 0.45 + 0.25 * pulse), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
					{v.title.slice(0, shown)}<span style={{color: accent, opacity: shown < v.title.length ? 1 : 0}}>▍</span>
				</div>
				<div style={{position: 'relative', width: CARD.w, height: BODY_H}}>
					<Body v={v} tl={tl} t={t} local={local} p={Math.min(1, local / Math.max(0.5, v.endS - v.startS))} w={CARD.w} h={BODY_H} pulse={pulse} accent={accent} />
					{fig ? <div style={{position: 'absolute', top: -2, right: 0, fontFamily: FONTS.display, fontSize: 13, color: accent}}>FIG. {fig}</div> : null}
				</div>
				<div style={{opacity: words}}>
					{entry.showText !== false && v.text ? <div style={{fontFamily: FONTS.body, fontSize: 15, lineHeight: 1.3, color: COLORS.ink, marginTop: 6,
						whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{v.text}</div> : null}
					<div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, borderTop: `1px solid ${accent}88`, paddingTop: 4, fontFamily: FONTS.mono,
						fontSize: 11, color: COLORS.dim, whiteSpace: 'nowrap', overflow: 'hidden'}}>
						<span style={{color: COLORS.bg, background: BADGE_COLORS[v.badge], borderRadius: 7, padding: '1px 7px', textTransform: 'uppercase'}}>{v.badge}</span>
						<span style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>{v.cite}</span>
					</div>
				</div>
			</div>
		);
	};

type Pose = {x: number; y: number; s: number; op: number};
const mix = (a: Pose, b: Pose, k: number): Pose => ({x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, s: a.s + (b.s - a.s) * k, op: a.op + (b.op - a.op) * k});

/** Local: blended pose of a panel: anchor -> slot (emerge), slot -> dock (dock). Global: where the panel is drawn. */
export const poseOf = (shot: Shot, anchor: Anchor, rect: Rect): Pose => {
	const origin: Pose = {x: anchor.x, y: anchor.y, s: 0.06, op: 0.3}; // inside its scene object
	const slot: Pose = {...fit(rect), op: 1}; // its place in the scene's layout
	const dock: Pose = anchor.dock.kind === 'thumb'
		? {x: anchor.dock.x, y: anchor.dock.y, s: anchor.dock.s, op: 0.92} // back into the object, as a thumbnail
		: {x: anchor.x, y: anchor.y, s: 0.05, op: 0}; // fly-through scenes: back into the object and gone
	return mix(mix(origin, slot, shot.emerge), dock, shot.dock);
};

/** Local: a panel at its pose: the card face on a plate in the scene accent. Global: one figure inside its scene. */
export const Panel: React.FC<{tl: Timeline; shot: Shot; pose: Pose; accent: string; t: number; pulse: number}> = ({tl, shot, pose, accent, t, pulse}) => {
	if (pose.op <= 0.01) return null;
	const words = 1 - smooth(shot.dock * 2); // text fades as it docks; the thumbnail keeps the picture
	return (
		<div style={{position: 'absolute', left: pose.x, top: pose.y, opacity: pose.op, transform: `translate(-50%, -50%) scale(${pose.s})`, transformOrigin: 'center',
			padding: 10, borderRadius: 14, background: 'rgba(6,8,22,0.78)', border: `1.5px solid ${accent}aa`, boxShadow: `0 0 ${18 + 10 * pulse}px ${accent}40`}}>
			<CardFace tl={tl} v={shot.v} t={t} accent={accent} pulse={pulse} fig={shot.fig} words={words} />
		</div>
	);
};
