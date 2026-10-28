/**
 * Outro — "The goal is to understand." (after the rewind)
 * Local: the outro's sung part is the flying rewind through the whole video (Anthem.tsx, stage/rewind.ts), which lands
 * on the intro's single token at the landing downbeat. This scene takes over there: the token bursts (a ring of
 * particles) while the overview's tiles fly out of it (stage/OverviewLayer.tsx), glides into the free centre of the mosaic,
 * and after the last word gives way to the final statement and the credits, then everything fades to black.
 * Global: closes the loop opened by IntroScene (one token -> the whole science -> one token -> everything at once).
 */
import React from 'react'; // JSX
import {AbsoluteFill, random} from 'remotion'; // layer + RNG
import {beatPulse} from '../lib/timeline'; // beat kick
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {rewindPlan} from '../stage/rewind'; // where the rewind lands
import {CENTRE, FADE_S, TOKEN} from '../stage/overview'; // the free centre of the mosaic
import type {SceneProps} from './types'; // contract

const P = 160; // burst particles
const C = {x: CENTRE[0] + CENTRE[2] / 2, y: CENTRE[1] + 70}; // the token's place in the centre, above the statement

export const OutroScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t} = useSceneClock(section); // time
	const pulse = beatPulse(tl.beats, t); // beat kick
	const land = rewindPlan(tl)?.end ?? section.startS; // the rewind lands on the token here
	const lastWord = tl.lines[tl.lines.length - 1]?.endS ?? section.endS - 6; // the statement follows the last word
	const glide = smooth((t - land) / 0.9); // token: the intro's position -> the centre
	const burst = smooth((t - land) / 1.8); // ring of particles flying out of it
	const final = smooth((t - lastWord - 0.3) / 0.8); // statement after the last word
	const black = smooth((t - (section.endS - FADE_S)) / FADE_S); // fade to black in the last seconds
	const x = TOKEN.x + (C.x - TOKEN.x) * glide, y = TOKEN.y + (C.y - TOKEN.y) * glide, s = 1 + 1.2 * glide; // the token's path
	return (
		<AbsoluteFill style={{opacity: 1 - black}}>
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				{Array.from({length: P}, (_, i) => { // everything the video showed, scattered out of one token
					const a = (i / P) * Math.PI * 2 + random(`a${i}`) * 0.2, r = 20 + (300 + random(`r${i}`) * 500) * burst;
					return <circle key={i} cx={x + Math.cos(a) * r} cy={y + Math.sin(a) * r * 0.6} r={3 + 2 * pulse} fill={i % 2 ? COLORS.cyan : COLORS.magenta} opacity={(1 - burst) * 0.9} />;
				})}
				<rect x={x - 13 * s} y={y - 11 * s} width={26 * s} height={22 * s} rx={4 * s} fill={COLORS.cyan} style={{filter: `drop-shadow(0 0 ${20 + 30 * pulse}px ${COLORS.cyan})`}} />
			</svg>
			<div style={{position: 'absolute', left: CENTRE[0], width: CENTRE[2], top: C.y + 44, textAlign: 'center', fontFamily: FONTS.display, fontWeight: 900, fontSize: 64, lineHeight: 1.05,
				color: COLORS.ink, textShadow: `${glow(COLORS.amber, 1.1)}, 0 0 16px #05060f`, WebkitTextStroke: '3px #05060f', paintOrder: 'stroke fill', opacity: final,
				transform: `scale(${1.25 - 0.25 * final})`}}>
				THE GOAL IS<br />TO UNDERSTAND.
			</div>
			<div style={{position: 'absolute', left: CENTRE[0], width: CENTRE[2], top: C.y + 200, textAlign: 'center', fontFamily: FONTS.mono, fontSize: 17, color: COLORS.ink,
				textShadow: '0 0 8px #05060f, 0 0 8px #05060f', opacity: smooth((t - lastWord - 2.5) / 1)}}>
				concept: Libor Burian · lyrics, code &amp; every frame: Claude · song: Suno V6
				<br />github.com/BurnyCoder/ambitious-science-of-information-processing-anthem
			</div>
		</AbsoluteFill>
	);
};
