/**
 * Outro — "The goal is to understand."
 * Local: a ring of particles slowly contracts back into the single glowing token from the intro, and with it every
 * figure title of the video (all cards in timeline.json) and the milestone years 1943 → 2026 spiral into the token;
 * after the last sung word the final statement appears, then the credits, then fade to black.
 * Global: closes the loop opened by IntroScene (one token -> the whole science -> one token).
 */
import React from 'react'; // JSX
import {AbsoluteFill, random} from 'remotion'; // layer + RNG
import {beatPulse} from '../lib/timeline'; // beat kick
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {MILESTONES} from '../vignettes/finale'; // dated landmarks
import type {SceneProps} from './types'; // contract

const P = 160; // particles
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // golden angle: even spiral spacing (https://en.wikipedia.org/wiki/Golden_angle)

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
				{tl.vignettes.map((v, i) => { // every figure of the video, on a spiral that winds into the token
					const a = i * GOLDEN + local * 0.25, r = (250 + 330 * (i / tl.vignettes.length)) * (1 - gather) + 4;
					return <text key={`v${i}`} x={960 + Math.cos(a) * r} y={470 + Math.sin(a) * r * 0.6} fill={i % 3 ? COLORS.ink : COLORS.cyan} fontFamily={FONTS.mono}
						fontSize={12 * (1 - 0.6 * gather)} textAnchor="middle" opacity={0.55 * (1 - smooth((gather - 0.8) / 0.2))}>{v.title}</text>;
				})}
				{MILESTONES.map(([year], i) => { // the years arrive one by one and fall in
					const k = smooth((local - i * 0.9) / 5); // 0 at the rim -> 1 at the token
					const a = i * 1.9 - k * 5;
					return <text key={`y${year}`} x={960 + Math.cos(a) * 520 * (1 - k)} y={470 + Math.sin(a) * 300 * (1 - k)} fill={COLORS.amber} fontFamily={FONTS.display}
						fontWeight={700} fontSize={30 * (1 - 0.7 * k)} textAnchor="middle" opacity={smooth(local - i * 0.9) * (1 - smooth((k - 0.85) / 0.15))}
						style={{textShadow: glow(COLORS.amber, 0.5)}}>{year}</text>;
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
