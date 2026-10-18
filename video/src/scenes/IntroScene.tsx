/**
 * Intro: a single token glows, unfolds into an embedding vector, then the title card.
 * Local: 2D SVG/CSS; token -> 16-cell vector (cells slide out, bar lengths are seeded values)
 * -> "WE WILL KNOW" letter-by-letter -> subtitle and credits.
 * Global: first scene; sets the "information processing starts from one token" motif that the outro reverses.
 */
import React from 'react'; // JSX
import {AbsoluteFill, random} from 'remotion'; // layer + deterministic RNG
import {beatPulse} from '../lib/timeline'; // beat pulse
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import type {SceneProps} from './types'; // contract

const CELLS = 16; // embedding dimensions shown

export const IntroScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t, local, length} = useSceneClock(section); // absolute + local time
	const pulse = beatPulse(tl.beats, t); // 1 at each beat, decays
	const unfold = smooth((local - 2.5) / 3.0); // token -> vector, 2.5..5.5 s
	const titleAt = Math.min(7, length * 0.4); // title starts by 7 s (or 40% of a short intro)
	const title = 'WE WILL KNOW'; // card text
	const shown = Math.floor(Math.max(0, (local - titleAt) / 0.12)); // one letter per 120 ms
	const exit = smooth((local - (length - 1.2)) / 1.2); // last 1.2 s: zoom out
	const tokenScale = smooth(local / 1.2) * (1 + 0.15 * pulse); // pop in, breathe on beats
	return (
		<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: 1 - exit * 0.8, transform: `scale(${1 + exit * 0.3})`}}>
			{/* token and its unfolding vector */}
			<div style={{position: 'absolute', left: 300, top: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 1 - smooth((local - titleAt) / 2) * 0.75}}>
				{Array.from({length: CELLS}, (_, i) => {
					const offset = (i - (CELLS - 1) / 2) * 24 * unfold; // cells spread vertically from the token (±180 px)
					const v = random(`emb${i}`) * 2 - 1; // seeded component in [-1, 1]
					return (
						<div key={i} style={{position: 'absolute', top: offset, display: 'flex', alignItems: 'center', opacity: i === 7 ? 1 : unfold}}>
							<div style={{width: 26, height: 22, borderRadius: 4, background: v > 0 ? COLORS.cyan : COLORS.magenta, opacity: 0.35 + 0.65 * Math.abs(v),
								boxShadow: `0 0 ${12 + 18 * pulse}px ${v > 0 ? COLORS.cyan : COLORS.magenta}`, transform: `scale(${i === 7 ? tokenScale : 1})`}} />
							<div style={{width: 160 * Math.abs(v) * unfold, height: 6, marginLeft: 10, background: COLORS.ink, opacity: 0.4}} />
						</div>
					);
				})}
				<div style={{position: 'absolute', top: -14, left: 60 + 180 * unfold, fontFamily: FONTS.mono, fontSize: 24, color: COLORS.dim, whiteSpace: 'nowrap'}}>
					{unfold < 0.5 ? 'token' : 'token → embedding  x ∈ ℝ^d'}
				</div>
			</div>
			{/* title card */}
			<div style={{marginTop: 260, fontFamily: FONTS.display, fontWeight: 900, fontSize: 150, letterSpacing: '0.08em', color: COLORS.ink, textShadow: glow(COLORS.cyan, 1 + 0.5 * pulse)}}>
				{title.slice(0, shown)}
				<span style={{opacity: shown < title.length ? 1 : 0}}>▍</span>
			</div>
			<div style={{fontFamily: FONTS.body, fontSize: 36, color: COLORS.ink, opacity: smooth((local - titleAt - 2) / 1.2), marginTop: 10}}>
				an anthem of ambitious science of information processing
			</div>
			<div style={{fontFamily: FONTS.mono, fontSize: 20, color: COLORS.dim, opacity: smooth((local - titleAt - 4) / 1.2), marginTop: 26}}>
				song: Suno V6 · lyrics, code &amp; every frame: Claude · concept: Libor Burian
			</div>
		</AbsoluteFill>
	);
};
