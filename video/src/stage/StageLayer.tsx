/**
 * The stage: every figure card visible at time t, drawn back to front.
 * Local: docked thumbnails first, then receded cards (deepest first), then the hero, so the newest example is
 * always on top and the older ones form a constellation in depth around it.
 * Global: sits in Anthem.tsx between the scene layer (which the camera pushes toward the hero's anchor) and the
 * lyrics. Card timing comes from timeline.json (anthem/vignettes.py); the lifecycle from shots.ts.
 */
import React from 'react'; // JSX
import {AbsoluteFill} from 'remotion'; // full-frame layer
import type {Timeline} from '../lib/timeline'; // data
import type {Anchor} from './anchors'; // dive origin + dock
import {heroness, type Shot as ShotState} from './shots'; // lifecycle
import {Shot} from './Shot'; // one card

export const StageLayer: React.FC<{tl: Timeline; staged: {shot: ShotState; anchor: Anchor}[]; t: number; big: boolean; pulse: number}> = ({tl, staged, t, big, pulse}) => (
	<AbsoluteFill>
		{[...staged].sort(({shot: a}, {shot: b}) => (b.dock - a.dock) || (heroness(a) - heroness(b)) || (b.rank - a.rank)).map(({shot, anchor}) => (
			<Shot key={`${shot.v.id}-${shot.v.startS}`} tl={tl} shot={shot} anchor={anchor} t={t} big={big} pulse={pulse} /> // anchors come from Anthem (computed once per frame)
		))}
	</AbsoluteFill>
);
