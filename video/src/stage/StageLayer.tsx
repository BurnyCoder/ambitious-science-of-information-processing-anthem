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
import {anchorOf} from './anchors'; // dive origins + docks
import {heroness, type Shot as ShotState} from './shots'; // lifecycle
import {Shot} from './Shot'; // one card

export const StageLayer: React.FC<{tl: Timeline; shots: ShotState[]; t: number; big: boolean; pulse: number}> = ({tl, shots, t, big, pulse}) => (
	<AbsoluteFill>
		{[...shots].sort((a, b) => (b.dock - a.dock) || (heroness(a) - heroness(b)) || (b.rank - a.rank)).map((s) => {
			const section = tl.sections.find((x) => x.index === s.v.sectionIndex)!; // its scene decides its anchor
			return <Shot key={`${s.v.id}-${s.v.startS}`} tl={tl} shot={s} anchor={anchorOf(tl, section, s.v, s.k, t)} t={t} big={big} pulse={pulse} />;
		})}
	</AbsoluteFill>
);
