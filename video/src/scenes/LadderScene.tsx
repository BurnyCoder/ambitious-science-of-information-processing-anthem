/**
 * Verse 2 — the ladder of abstraction.
 * Local: a glowing ladder whose rungs light up, bottom to top, exactly when their keyword
 * is sung (neurons & heads -> activation manifolds -> parameter components -> algorithms ->
 * decisions -> behaviors -> drives); the climber rides up with them. The ladder stands in the left third at full
 * height and stays visible: each rung's figure is a panel on the right (stage/layout.json), wired to the end of the
 * rung's label, and docks there as a chip. On "drives" the shoggoth mask rises behind the top rungs (a card the
 * scene draws itself). On "encyclopedia" an open book appears above the top rung and the titles of the docked
 * figures fly up into it, one entry each, so the encyclopedia visibly fills.
 * Global: visualizes Goodfire's research roadmap ("We can and must solve alignment",
 * https://www.goodfire.com/blog/we-can-and-must-solve-alignment).
 */
import React from 'react'; // JSX
import {AbsoluteFill} from 'remotion'; // layer
import {beatPulse, sinceBeat, wordTime, type Section, type Timeline, type Vignette} from '../lib/timeline'; // keyword timing
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {cardsOn} from '../stage/shots'; // the cards this scene draws itself
import {VIGNETTES} from '../vignettes'; // their bodies
import type {SceneProps} from './types'; // contract

export const RUNGS: [string, RegExp][] = [ // label, keyword that triggers it
	['neurons & attention heads', /neuron/i],
	['activation manifolds', /manifold/i],
	['parameter components', /parameter/i],
	['algorithms', /algorithm/i],
	['decisions', /decision/i],
	['behaviors', /behavior/i],
	['drives', /drive/i],
];
export const RUNG_GAP = 100; // px between rungs
export const BASE = 820; // y of the bottom rung (above the lyric overlay)
export const LADDER_LEFT = 120; // x of the ladder container; rails at +60 and +300, labels from +344 (left third)
const LABEL_X = LADDER_LEFT + 344, CHAR_W = 17.3; // rung labels: start and advance of 27 px Orbitron bold (≈ 0.64 em)

/** Local: where a rung's figure is wired to: the end of its label (rung RUNGS.length = the book). Global: stage/anchors.ts. */
export const rungAnchor = (rung: number) => rung >= RUNGS.length ? {x: LADDER_LEFT + 290, y: BASE - RUNGS.length * RUNG_GAP}
	: {x: LABEL_X + RUNGS[rung][0].length * CHAR_W + 12, y: BASE - rung * RUNG_GAP + 5};

/** Local: when each rung's keyword is sung (evenly spaced if missing). Global: rung lighting here and card anchors in stage/anchors.ts. */
export const rungTimes = (tl: Timeline, section: Section): number[] =>
	RUNGS.map(([, re], i) => wordTime(tl, section, re) ?? section.startS + ((i + 1) / 9) * (section.endS - section.startS));

/** Local: the rung a ladder card belongs to: the last rung sung by its start, or the book above the ladder (RUNGS.length)
 * once "encyclopedia" has been sung. Global: ladder anchors and stacking (stage/anchors.ts) and the book's entries here. */
export const ladderRung = (tl: Timeline, section: Section, v: Vignette): number => {
	const encyclo = wordTime(tl, section, /encyclopedia/i);
	if (encyclo !== null && v.startS >= encyclo - 0.3) return RUNGS.length; // the encyclopedia sits above the top rung
	return Math.max(0, rungTimes(tl, section).filter((s) => s <= v.startS + 0.3).length - 1);
};
const BOOK_X = LADDER_LEFT + 184, BOOK_Y = BASE - RUNGS.length * RUNG_GAP; // the book's spine, one gap above the top rung

/** Local: an open book whose pages turn on the beat. Global: "the encyclopedia of everything inside". */
const Book: React.FC<{open: number; flip: number}> = ({open, flip}) => {
	const page = (d: number) => `M 0 18 Q ${d * 45} 4 ${d * 92} 12 L ${d * 92} -34 Q ${d * 45} -42 0 -26 Z`; // one page, d = ±1
	return (
		<g transform={`translate(${BOOK_X} ${BOOK_Y}) scale(${open} ${open})`} style={{filter: `drop-shadow(0 0 14px ${COLORS.amber})`}}>
			{[-1, 1].map((d) => <path key={d} d={page(d)} fill="rgba(4,5,13,0.85)" stroke={COLORS.amber} strokeWidth={2.5} />)}
			{[-1, 1].flatMap((d) => [0, 1, 2, 3].map((k) => <line key={`${d}${k}`} x1={d * 12} y1={-16 + k * 8} x2={d * 80} y2={-20 + k * 8} stroke={COLORS.amber} strokeOpacity={0.5} />))}
			<path d={page(Math.cos(flip * Math.PI))} fill="rgba(255,200,87,0.18)" stroke={COLORS.amber} strokeWidth={1.5} /> {/* the turning page */}
		</g>
	);
};

export const LadderScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t} = useSceneClock(section); // time
	const pulse = beatPulse(tl.beats, t); // beat kick
	const times = rungTimes(tl, section); // when each rung is sung
	const lit = times.map((s) => smooth((t - s) / 0.25)); // 0..1 per rung
	const level = lit.reduce((a, b) => a + b, 0); // how many rungs are lit (fractional)
	const encyclo = wordTime(tl, section, /encyclopedia/i) ?? section.endS - 7; // the book opens
	const open = smooth((t - encyclo) / 0.6);
	const flip = smooth(sinceBeat(tl.beats, t) / 0.35); // one page turn per beat: 0 -> 1 after each beat
	const entries = tl.vignettes.filter((v) => v.sectionIndex === section.index && ladderRung(tl, section, v) < RUNGS.length); // figures on the rungs
	const filed = entries.filter((_, i) => t > encyclo + 0.5 + i * 0.35 + 0.9).length; // entries already in the book
	const mask = cardsOn(tl.vignettes, section.index, t).find((c) => c.v.id === 'shoggoth'); // "the drives behind the face"
	const Mask = VIGNETTES.shoggoth?.Body;
	return (
		<AbsoluteFill>
			{mask && Mask ? <div style={{position: 'absolute', left: LADDER_LEFT + 180 - 300, top: 120, width: 600, height: 250, opacity: 0.45 * mask.on,
				transform: `scale(${0.85 + 0.15 * mask.on})`, filter: 'saturate(1.2)'}}> {/* behind the rails: the ladder stays in front */}
				<Mask v={mask.v} tl={tl} t={t} local={t - mask.v.startS} p={0.5} w={600} h={250} pulse={pulse} accent={COLORS.amber} />
			</div> : null}
			<div style={{position: 'absolute', left: LADDER_LEFT, top: 0, width: 800, height: 1080}}>
				{[0, 1].map((side) => ( // two rails
					<div key={side} style={{position: 'absolute', left: side ? 300 : 60, top: BASE - (RUNGS.length - 1) * RUNG_GAP - 70, width: 8, height: (RUNGS.length - 1) * RUNG_GAP + 140,
						background: `linear-gradient(0deg, ${COLORS.cyan}, ${COLORS.violet})`, boxShadow: `0 0 18px ${COLORS.cyan}`, opacity: 0.8}} />
				))}
				<div style={{position: 'absolute', left: 168, top: BASE - Math.max(0, level - 1) * RUNG_GAP - 22, width: 44, height: 44, borderRadius: 22, background: COLORS.ink,
					boxShadow: `0 0 ${24 + 30 * pulse}px ${COLORS.cyan}`, opacity: smooth(level)}} /> {/* the climber: rides up to the latest lit rung */}
				<svg width={1920} height={1080} style={{position: 'absolute', left: -LADDER_LEFT, top: 0, overflow: 'visible'}}>
					<Book open={open} flip={flip} />
					{entries.map((v, i) => { // each docked figure's title flies from its rung up into the book
						const k = smooth((t - encyclo - 0.5 - i * 0.35) / 0.9), y0 = BASE - ladderRung(tl, section, v) * RUNG_GAP;
						return k > 0 && k < 1 ? <text key={v.id + i} x={LADDER_LEFT - 60 + (BOOK_X - LADDER_LEFT + 60) * k} y={y0 + (BOOK_Y - 8 - y0) * k} fill={COLORS.amber}
							fontFamily={FONTS.mono} fontSize={16 * (1 - 0.6 * k)} textAnchor="middle" opacity={1 - k * 0.5}>{v.title}</text> : null;
					})}
					<text x={BOOK_X + 110} y={BOOK_Y - 6} fill={COLORS.ink} fontFamily={FONTS.display} fontWeight={700} fontSize={22} opacity={open} style={{textShadow: glow(COLORS.amber, 0.6)}}>
						encyclopedia of explanations
					</text>
					<text x={BOOK_X + 110} y={BOOK_Y + 18} fill={COLORS.amber} fontFamily={FONTS.mono} fontSize={16} opacity={open}>{filed} / {entries.length} entries filed</text>
				</svg>
				{RUNGS.map(([label], i) => {
					const y = BASE - i * RUNG_GAP; // bottom rung first
					const a = lit[i]; // reveal amount
					const color = i < 2 ? COLORS.cyan : i < 4 ? COLORS.magenta : COLORS.amber; // representation / mechanism / behavior bands
					return (
						<div key={i} style={{position: 'absolute', top: y, left: 60}}>
							<div style={{width: 248 * a, height: 10, marginLeft: 8, background: color, boxShadow: `0 0 ${16 + 14 * pulse * a}px ${color}`}} />
							<div style={{position: 'absolute', left: 284, top: -15, whiteSpace: 'nowrap', fontFamily: FONTS.display, fontWeight: 700, fontSize: 27,
								color: COLORS.ink, opacity: a, textShadow: glow(color, 0.6 * a), transform: `translateX(${(1 - a) * 40}px)`}}>
								{label}
							</div>
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
