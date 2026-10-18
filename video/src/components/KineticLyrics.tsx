/**
 * Karaoke caption at the bottom of the frame.
 * Local: shows the current lyric line; each word brightens and pops exactly when Suno's
 * aligned timing says it is sung (sung = white, now = neon + glow, upcoming = dim).
 * Global: overlay used in every scene except the chorus-type scenes, which render
 * the lyrics themselves as giant words (see BigWords.tsx).
 * Sources: https://www.remotion.dev/docs/absolute-fill ; timings from anthem/alignment.py
 */
import React from 'react'; // JSX
import {AbsoluteFill} from 'remotion'; // full-frame positioned layer
import {activeWordIndex, lineAt, type Timeline} from '../lib/timeline'; // caption lookup
import {COLORS, FONTS, glow, smooth} from '../lib/theme'; // look

export const KineticLyrics: React.FC<{tl: Timeline; t: number; accent?: string}> = ({tl, t, accent = COLORS.cyan}) => {
	const line = lineAt(tl, t); // caption active at time t
	if (!line) return null; // between lines: nothing
	const appear = smooth((t - (line.startS - 0.35)) / 0.25); // 0.25 s fade/slide in
	const leave = 1 - smooth((t - line.endS - 0.9) / 0.3); // fade out after the hold
	const active = activeWordIndex(line, t); // word being sung
	return (
		<AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 70}}>
			<div
				style={{
					maxWidth: 1640, // keep inside the 1920 frame with margins
					padding: '18px 36px', // breathing room around the words
					borderRadius: 18, // soft plate
					background: 'linear-gradient(180deg, rgba(4,5,13,0.0), rgba(4,5,13,0.72))', // readability plate
					textAlign: 'center',
					fontFamily: FONTS.body,
					fontWeight: 600,
					fontSize: line.backing ? 40 : 52, // echo lines are smaller
					lineHeight: 1.25,
					opacity: appear * leave, // combined fade
					transform: `translateY(${(1 - appear) * 24}px)`, // slide up while appearing
				}}
			>
				{line.words.map((w, i) => {
					const now = i === active; // currently sung word
					const sung = i < active; // already sung
					const pop = now ? 1 + 0.14 * Math.exp(-(t - w.startS) / 0.14) : 1; // scale kick at onset
					return (
						<span
							key={i}
							style={{
								display: 'inline-block', // allows transform per word
								margin: '0 0.2em',
								color: now ? accent : sung ? COLORS.ink : COLORS.dim, // state colors
								textShadow: now ? glow(accent, 0.55) : 'none', // neon only on the active word
								fontStyle: w.backing ? 'italic' : 'normal', // backing vocals in italics
								transform: `scale(${pop})`,
							}}
						>
							{w.text}
						</span>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
