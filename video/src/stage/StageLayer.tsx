/**
 * The panels of the current moment, wired to the scene objects they explain.
 * Local: for every panel (shots.ts) a connector line and a ring mark the object it came from (anchors.ts), drawn first,
 * then the panels in their slots (stage/layout.json); docked thumbnails go underneath live panels. An optional debug
 * overlay draws the scene's slots, protected regions and lyric bands.
 * Global: sits in Anthem.tsx right above the scene layer; the scene is never dimmed or pushed for a figure.
 */
import React from 'react'; // JSX
import {AbsoluteFill} from 'remotion'; // full-frame layer
import type {Timeline} from '../lib/timeline'; // data
import type {Anchor} from './anchors'; // dive origin + dock
import {CARD, debugRects, type Rect} from './layout'; // native card size, slots + debug rects
import {Panel, poseOf} from './Shot'; // one panel
import type {Shot} from './shots'; // lifecycle

export type Staged = {shot: Shot; anchor: Anchor; rect: Rect; accent: string}; // one panel with its object, slot and colour

/** Local: the point of the panel's plate closest to its object. Global: where the connector leaves the panel. */
const edgePoint = (p: {x: number; y: number; s: number}, a: {x: number; y: number}) => {
	const hw = (CARD.w / 2 + 10) * p.s, hh = (CARD.h / 2 + 10) * p.s; // plate half-size incl. padding
	return {x: Math.min(p.x + hw, Math.max(p.x - hw, a.x)), y: Math.min(p.y + hh, Math.max(p.y - hh, a.y))}; // clamp to the plate
};

export const StageLayer: React.FC<{tl: Timeline; staged: Staged[]; t: number; pulse: number; scene: string; debug?: boolean}> = ({tl, staged, t, pulse, scene, debug}) => {
	const items = staged.map((st) => ({...st, pose: poseOf(st.shot, st.anchor, st.rect)})).sort((a, b) => b.shot.dock - a.shot.dock); // docked underneath
	return (
		<AbsoluteFill>
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				{items.map(({shot, anchor, pose, accent}) => { // connector + ring: the panel belongs to this object
					const wire = shot.emerge * (1 - shot.dock);
					if (wire < 0.01) return null;
					const e = edgePoint(pose, anchor);
					return <g key={`${shot.v.id}-${shot.v.startS}`} opacity={0.85 * wire}>
						<line x1={e.x} y1={e.y} x2={anchor.x} y2={anchor.y} stroke={accent} strokeWidth={2} strokeDasharray="6 5" />
						<circle cx={anchor.x} cy={anchor.y} r={11 + 4 * pulse} fill="none" stroke={accent} strokeWidth={2.5} style={{filter: `drop-shadow(0 0 6px ${accent})`}} />
						<circle cx={anchor.x} cy={anchor.y} r={4} fill={accent} />
					</g>;
				})}
				{debug ? debugRects(scene).map(({r, kind}, i) => <rect key={i} x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill="none" strokeWidth={3}
					stroke={kind === 'slot' ? '#22e4ff' : kind === 'protect' ? '#ff3b3b' : '#ffc857'} strokeDasharray={kind === 'band' ? '10 8' : undefined} />) : null}
			</svg>
			{items.map(({shot, pose, accent}) => <Panel key={`${shot.v.id}-${shot.v.startS}`} tl={tl} shot={shot} pose={pose} accent={accent} t={t} pulse={pulse} />)}
		</AbsoluteFill>
	);
};
