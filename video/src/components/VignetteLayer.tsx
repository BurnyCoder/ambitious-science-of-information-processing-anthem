/**
 * The illustration track: draws every figure card that is on screen at time t.
 * Local: looks up each active card's slot box and body component, numbers it (FIG. n = its order in the
 * song), picks an accent color by section, and wraps the body in the shared Card frame.
 * Global: sits in Anthem.tsx between the section scenes and the karaoke, so cards cover scene edges but never
 * the lyrics. Card timing comes from timeline.json (anthem/vignettes.py).
 */
import React from 'react'; // JSX
import {AbsoluteFill} from 'remotion'; // full-frame layer
import {activeVignettes, beatPulse, type Timeline} from '../lib/timeline'; // which cards, beat kick
import {COLORS} from '../lib/theme'; // palette
import {Card, cardLayout} from '../vignettes/primitives'; // frame + layout
import {VIGNETTES, FALLBACK} from '../vignettes'; // id -> body

const ACCENTS = [COLORS.cyan, COLORS.magenta, COLORS.violet, COLORS.lime, COLORS.amber]; // cycled per section

export const VignetteLayer: React.FC<{tl: Timeline; t: number}> = ({tl, t}) => {
	const pulse = beatPulse(tl.beats, t); // 1 on each beat, decays
	return (
		<AbsoluteFill>
			{activeVignettes(tl, t).map((v) => {
				const box = tl.slots[v.slot]; // [x, y, w, h]
				const entry = VIGNETTES[v.id] ?? FALLBACK; // body component
				const accent = tl.sections.find((s) => s.index === v.sectionIndex)?.kind.includes('final') ? COLORS.amber : ACCENTS[v.sectionIndex % ACCENTS.length];
				const {bodyW, bodyH} = cardLayout(v, box[2], box[3], entry.showText !== false);
				const local = t - v.startS; // seconds since the card appeared
				const Body = entry.Body;
				return (
					<Card key={`${v.id}-${v.startS}`} v={v} fig={tl.vignettes.indexOf(v) + 1} t={t} box={box} pulse={pulse} accent={accent} showText={entry.showText !== false}>
						<Body v={v} tl={tl} t={t} local={local} p={Math.min(1, local / Math.max(0.5, v.endS - v.startS))} w={bodyW} h={bodyH} pulse={pulse} accent={accent} />
					</Card>
				);
			})}
		</AbsoluteFill>
	);
};
