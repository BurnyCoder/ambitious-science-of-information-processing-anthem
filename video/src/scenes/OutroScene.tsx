/**
 * Outro — "The goal is to understand."
 * Local: a ring of particles slowly contracts back into the single glowing token from the intro;
 * after the last sung word the final statement appears, then the credits, then fade to black.
 * Global: closes the loop opened by IntroScene (one token -> the whole science -> one token).
 */
import React from 'react'; // JSX
import {AbsoluteFill, random} from 'remotion'; // layer + RNG
import {beatPulse} from '../lib/timeline'; // beat kick
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import type {SceneProps} from './types'; // contract

const P = 160; // particles

export const OutroScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t, local, length} = useSceneClock(section); // time
	const pulse = beatPulse(tl.beats, t); // beat kick
	const lastWord = tl.lines[tl.lines.length - 1]?.endS ?? section.endS - 6; // end of the vocals
	const gather = smooth(local / (length * 0.8)); // ring -> point
	const final = smooth((t - lastWord - 0.3) / 0.8); // statement after the last word
	const black = smooth((t - (section.endS - 3)) / 2.5); // fade to black in the last seconds
	return (
		<AbsoluteFill style={{opacity: 1 - black}}>
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				{Array.from({length: P}, (_, i) => {
					const a = (i / P) * Math.PI * 2 + local * 0.2; // angle, slowly turning
					const r = (420 + random(`r${i}`) * 140) * (1 - gather) + 6; // radius shrinks to the token
					return <circle key={i} cx={960 + Math.cos(a) * r} cy={470 + Math.sin(a) * r * 0.6} r={3 + 2 * pulse} fill={i % 2 ? COLORS.cyan : COLORS.magenta} opacity={0.4 + 0.6 * gather} />;
				})}
				<rect x={960 - 22} y={470 - 22} width={44} height={44} rx={6} fill={COLORS.cyan} opacity={gather} style={{filter: `drop-shadow(0 0 ${20 + 30 * pulse}px ${COLORS.cyan})`}} />
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
