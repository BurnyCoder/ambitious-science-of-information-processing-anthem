/**
 * Verse 2 — the ladder of abstraction.
 * Local: a glowing ladder whose rungs light up, bottom to top, exactly when their keyword
 * is sung (neurons & heads -> activation manifolds -> parameter components -> algorithms ->
 * decisions -> behaviors -> drives); the view climbs with them. The last two lines open the
 * "encyclopedia of explanations".
 * Global: visualizes Goodfire's research roadmap ("We can and must solve alignment",
 * https://www.goodfire.com/blog/we-can-and-must-solve-alignment).
 */
import React from 'react'; // JSX
import {AbsoluteFill} from 'remotion'; // layer
import {beatPulse, wordTime} from '../lib/timeline'; // keyword timing
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {Caption} from '../components/Overlays'; // labels
import type {SceneProps} from './types'; // contract

const RUNGS: [string, RegExp][] = [ // label, keyword that triggers it
	['neurons & attention heads', /neuron/i],
	['activation manifolds', /manifold/i],
	['parameter components', /parameter/i],
	['algorithms', /algorithm/i],
	['decisions', /decision/i],
	['behaviors', /behavior/i],
	['drives', /drive/i],
];
const RUNG_GAP = 100; // px between rungs
const BASE = 820; // y of the bottom rung (above the lyric overlay)

export const LadderScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t, local, length} = useSceneClock(section); // time
	const pulse = beatPulse(tl.beats, t); // beat kick
	const times = RUNGS.map(([, re], i) => wordTime(tl, section, re) ?? section.startS + ((i + 1) / 9) * length); // fallback: evenly spaced
	const lit = times.map((s) => smooth((t - s) / 0.25)); // 0..1 per rung
	const level = lit.reduce((a, b) => a + b, 0); // how many rungs are lit (fractional)
	const encyclo = wordTime(tl, section, /encyclopedia/i) ?? section.startS + 0.75 * length; // book opens
	const book = smooth((t - encyclo) / 0.8); // 0..1
	const fact = wordTime(tl, section, /recalls/i) ?? encyclo + 3; // entries appear when sung
	const reason = wordTime(tl, section, /reasoning/i) ?? encyclo + 5;
	return (
		<AbsoluteFill>
			<div style={{position: 'absolute', left: 560, top: 0, width: 800, height: 1080}}>
				{[0, 1].map((side) => ( // two rails
					<div key={side} style={{position: 'absolute', left: side ? 300 : 60, top: BASE - (RUNGS.length - 1) * RUNG_GAP - 70, width: 8, height: (RUNGS.length - 1) * RUNG_GAP + 140,
						background: `linear-gradient(0deg, ${COLORS.cyan}, ${COLORS.violet})`, boxShadow: `0 0 18px ${COLORS.cyan}`, opacity: 0.8}} />
				))}
				<div style={{position: 'absolute', left: 168, top: BASE - Math.max(0, level - 1) * RUNG_GAP - 22, width: 44, height: 44, borderRadius: 22, background: COLORS.ink,
					boxShadow: `0 0 ${24 + 30 * pulse}px ${COLORS.cyan}`, opacity: smooth(level)}} /> {/* the climber: rides up to the latest lit rung */}
				{RUNGS.map(([label], i) => {
					const y = BASE - i * RUNG_GAP; // bottom rung first
					const a = lit[i]; // reveal amount
					const color = i < 2 ? COLORS.cyan : i < 4 ? COLORS.magenta : COLORS.amber; // representation / mechanism / behavior bands
					return (
						<div key={i} style={{position: 'absolute', top: y, left: 60}}>
							<div style={{width: 248 * a, height: 10, marginLeft: 8, background: color, boxShadow: `0 0 ${16 + 14 * pulse * a}px ${color}`}} />
							<div style={{position: 'absolute', left: 290, top: -22, whiteSpace: 'nowrap', fontFamily: FONTS.display, fontWeight: 700, fontSize: 40,
								color: COLORS.ink, opacity: a, textShadow: glow(color, 0.6 * a), transform: `translateX(${(1 - a) * 40}px)`}}>
								{label}
							</div>
						</div>
					);
				})}
			</div>
			<Caption local={local} at={0.6} x={70} y={110} title="the ladder of abstraction" sub="from neurons to drives — Goodfire research roadmap" />
			<div style={{position: 'absolute', left: 70, top: 560, width: 470, padding: 26, border: `2px solid ${COLORS.lime}`, borderRadius: 14, opacity: book,
				transform: `translateY(${(1 - book) * 30}px)`, background: 'rgba(4,5,13,0.7)', boxShadow: `0 0 30px rgba(157,255,92,0.35)`}}>
				<div style={{fontFamily: FONTS.display, fontSize: 26, color: COLORS.lime}}>ENCYCLOPEDIA OF EXPLANATIONS</div>
				{[['how does it recall a fact?', fact], ['where does the reasoning hide?', reason]].map(([q, at], k) => (
					<div key={k} style={{fontFamily: FONTS.mono, fontSize: 22, color: COLORS.ink, marginTop: 16, opacity: smooth((t - (at as number)) / 0.4)}}>
						§{k + 1}. {q as string} → <span style={{color: COLORS.lime}}>mechanism ✓</span>
					</div>
				))}
			</div>
		</AbsoluteFill>
	);
};
