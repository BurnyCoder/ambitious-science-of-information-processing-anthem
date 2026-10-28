/**
 * Outro — "The goal is to understand." (after the rewind)
 * Local: the outro's sung part is the flying rewind through the whole video (Anthem.tsx, stage/rewind.ts), which lands
 * on the intro's single token. This scene takes over at that moment: the token glides from where the intro left it to
 * the centre and bursts into a ring of particles, then the final statement appears, then the credits, then a fade to
 * black.
 * Global: closes the loop opened by IntroScene (one token -> the whole science -> one token).
 */
import React from 'react'; // JSX
import {AbsoluteFill, random} from 'remotion'; // layer + RNG
import {beatPulse} from '../lib/timeline'; // beat kick
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import type {SceneProps} from './types'; // contract

const P = 160; // burst particles
const TOKEN = {x: 313, y: 411}; // where the intro's token sits (IntroScene: the cell at left 300, top 400)

export const OutroScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t} = useSceneClock(section); // time
	const pulse = beatPulse(tl.beats, t); // beat kick
	const lastWord = tl.lines[tl.lines.length - 1]?.endS ?? section.endS - 6; // the rewind lands here
	const glide = smooth((t - lastWord) / 0.9); // token: intro position -> centre
	const burst = smooth((t - lastWord - 0.3) / 1.8); // ring of particles flying out of it
	const final = smooth((t - lastWord - 0.3) / 0.8); // statement after the last word
	const black = smooth((t - (section.endS - 3)) / 2.5); // fade to black in the last seconds
	const x = TOKEN.x + (960 - TOKEN.x) * glide, y = TOKEN.y + (470 - TOKEN.y) * glide, s = 1 + 1.2 * glide; // the token's path
	return (
		<AbsoluteFill style={{opacity: 1 - black}}>
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				{Array.from({length: P}, (_, i) => { // everything the video showed, scattered out of one token
					const a = (i / P) * Math.PI * 2 + random(`a${i}`) * 0.2, r = 20 + (300 + random(`r${i}`) * 500) * burst;
					return <circle key={i} cx={x + Math.cos(a) * r} cy={y + Math.sin(a) * r * 0.6} r={3 + 2 * pulse} fill={i % 2 ? COLORS.cyan : COLORS.magenta} opacity={(1 - burst) * 0.9} />;
				})}
				<rect x={x - 13 * s} y={y - 11 * s} width={26 * s} height={22 * s} rx={4 * s} fill={COLORS.cyan} style={{filter: `drop-shadow(0 0 ${20 + 30 * pulse}px ${COLORS.cyan})`}} />
			</svg>
			<div style={{position: 'absolute', top: 620, width: '100%', textAlign: 'center', fontFamily: FONTS.display, fontWeight: 900, fontSize: 72, color: COLORS.ink, textShadow: glow(COLORS.cyan, 1), opacity: final}}>
				THE GOAL IS TO UNDERSTAND.
			</div>
			<div style={{position: 'absolute', top: 740, width: '100%', textAlign: 'center', fontFamily: FONTS.mono, fontSize: 22, color: COLORS.dim, opacity: smooth((t - lastWord - 2.5) / 1)}}>
				concept: Libor Burian · lyrics, code &amp; every frame: Claude · song: Suno V6
				<br />github.com/BurnyCoder/ambitious-science-of-information-processing-anthem
			</div>
		</AbsoluteFill>
	);
};
