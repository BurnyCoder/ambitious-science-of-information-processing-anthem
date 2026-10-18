/**
 * Giant kinetic typography for chorus-type scenes.
 * Local: the word being sung fills the center of the frame (slam-in scale + glow at its
 * exact onset, beat-synced breathing), with the full line as a small caption below.
 * Global: used by ChorusScene and FinaleScene; replaces the bottom karaoke overlay there.
 */
import React from 'react'; // JSX
import {AbsoluteFill} from 'remotion'; // full-frame layer
import {activeWordIndex, beatPulse, lineAt, type Timeline} from '../lib/timeline'; // timing lookups
import {COLORS, FONTS, glow, smooth} from '../lib/theme'; // look

const clean = (s: string) => s.replace(/[()]/g, '').toUpperCase(); // "(We" -> "WE"

export const BigWords: React.FC<{tl: Timeline; t: number; color: string; y?: number}> = ({tl, t, color, y = 0}) => {
	const line = lineAt(tl, t); // current caption
	if (!line) return null; // instrumental moment
	const idx = activeWordIndex(line, t); // index of sung word
	const i = Math.min(Math.max(idx, 0), line.words.length - 1); // clamp: before -> first, after -> last
	const word = line.words[i]; // the word to show
	const since = t - word.startS; // seconds since its onset
	const slam = idx < 0 ? smooth((t - (word.startS - 0.35)) / 0.35) * 0.4 : 0.4 + 0.6 * smooth(since / 0.09); // anticipation then slam
	const scale = 1.35 - 0.35 * slam + 0.04 * beatPulse(tl.beats, t); // big -> settle, breathe on beats
	const fade = idx >= line.words.length ? 1 - smooth((t - line.endS) / 0.6) : 1; // fade after the line
	return (
		<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', transform: `translateY(${y}px)`}}>
			<div
				style={{
					fontFamily: FONTS.display,
					fontWeight: 900,
					fontSize: Math.min(210, 1650 / (clean(word.text).length * 0.9)), // fit: Orbitron 900 ≈ 0.9 em per glyph incl. spacing
					letterSpacing: '0.04em',
					color: COLORS.ink,
					textShadow: glow(color, 1.1), // strong neon
					opacity: slam * fade,
					transform: `scale(${scale})`,
					fontStyle: word.backing ? 'italic' : 'normal', // echo words slanted
				}}
			>
				{clean(word.text)}
			</div>
			<div
				style={{
					marginTop: 40,
					maxWidth: 1500,
					textAlign: 'center',
					fontFamily: FONTS.body,
					fontSize: 38,
					fontWeight: 600,
					color: COLORS.dim,
					opacity: fade,
				}}
			>
				{line.words.map((w, k) => (
					<span key={k} style={{margin: '0 0.18em', color: k <= idx ? COLORS.ink : COLORS.dim}}>
						{w.text}
					</span>
				))}
			</div>
		</AbsoluteFill>
	);
};
