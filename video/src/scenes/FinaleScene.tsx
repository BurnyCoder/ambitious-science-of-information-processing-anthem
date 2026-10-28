/**
 * Final chorus (key change) — ideal solving.
 * Local: gold palette; a slowly turning gold halo that pulses on beats behind the giant sung words. Concrete layers
 * behind it, all from the finale's own figures:
 *  - a rain of the kProgram card's 280 bits, which collapses on "shortest" into the short program that prints them;
 *  - ARC-style cells (the arc card's palette) drifting upward;
 *  - a frame-wide causal graph (the dag card's nodes); on "counterfactual" the arrows into "circuit" are cut by
 *    do(circuit := c′) and the change flows on to "behavior".
 * The figure panels (ideal solving, ARC, AIXI, the do()-graph, ActAdd, compression) sit in the two upper corners, wired to
 * the halo; the closing "Intentional design" card is an amber banner the scene draws itself, bridging into the outro.
 * Global: the song's definition of "fully understanding": the most compressed theory that predicts any behavior
 * and any intervention (Kolmogorov 1965; Pearl 2009; Chollet 2019).
 */
import React from 'react'; // JSX
import {AbsoluteFill, random} from 'remotion'; // layer + seeded RNG
import {beatPulse, wordTime} from '../lib/timeline'; // beat kick + lyric triggers
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {BITS, PAL, PROGRAM} from '../vignettes/finale'; // the cards' own data
import {cardsOn} from '../stage/shots'; // the cards this scene draws itself
import type {SceneProps} from './types'; // contract

const RAIN_COLS = 28; // 28 columns x 10 rows = the 280 bits
const CHAR_W = 12.6; // advance of one 21 px mono character (px)
const PROG_Y = 972; // baseline of the program (under the giant words, clear of the citation ticker)
const PROG_TEXT = PROGRAM.replace('\n', '; '); // one line
const NOTE = `   · 280 bits → ${PROGRAM.length} characters`; // compression ratio, same line
const PROG_X = 960 - ((PROG_TEXT.length + NOTE.length) * CHAR_W) / 2; // centred with its note
const CELLS = 64; // drifting ARC cells
/** Local: the causal graph's nodes spread over the whole frame (ids as in the dag card). */
const DAG: Record<string, [number, number]> = {data: [170, 540], hyperparams: [960, 112], features: [380, 655], circuit: [1540, 655], behavior: [1750, 540]}; // below the corner panels
const EDGES: [string, string][] = [['data', 'features'], ['hyperparams', 'features'], ['features', 'circuit'], ['hyperparams', 'circuit'], ['circuit', 'behavior']];

export const FinaleScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t, local} = useSceneClock(section); // time
	const pulse = beatPulse(tl.downbeats, t, 0.25); // bar-level kick
	const at = (re: RegExp, frac: number) => wordTime(tl, section, re) ?? section.startS + frac * (section.endS - section.startS); // lyric trigger
	const collapse = smooth((t - at(/shortest/i, 0.25) - 0.3) / 1.4); // bits fly into the program
	const iv = smooth((t - at(/counterfactual/i, 0.45)) / 0.5); // do() applied
	const banner = cardsOn(tl.vignettes, section.index, t).find((c) => c.v.title === 'Intentional design'); // the closing card
	const progAt = (i: number) => PROG_X + (5 + (i % 20)) * CHAR_W; // bit i lands on its character of the period inside p = "..."
	return (
		<AbsoluteFill>
			<svg width={1920} height={1080} style={{position: 'absolute', opacity: smooth(local / 0.8)}}>
				{Array.from({length: CELLS}, (_, i) => { // ARC cells drifting up
					const s = 10 + 10 * random(`cs${i}`), v = 18 + 30 * random(`cv${i}`);
					const x = random(`cx${i}`) * 1920 + Math.sin(local * 0.4 + i) * 24, y = ((random(`cy${i}`) * 1180 - local * v) % 1180 + 1180) % 1180 - 50;
					return <rect key={`c${i}`} x={x} y={y} width={s} height={s} rx={2} fill={PAL[1 + (i % 4)]} opacity={0.28} transform={`rotate(${local * 20 + i * 37} ${x + s / 2} ${y + s / 2})`} />;
				})}
				{[...BITS].map((b, i) => { // bit rain -> the program
					const c = i % RAIN_COLS, r = Math.floor(i / RAIN_COLS), v = 60 + 80 * random(`rv${c}`);
					const rx = 80 + (c * (1920 - 160)) / (RAIN_COLS - 1), ry = ((r * 118 + local * v + random(`ry${c}`) * 400) % 1180) - 60;
					const k = smooth(collapse * 1.6 - (i / BITS.length) * 0.6); // staggered landing
					return <text key={`b${i}`} x={rx + (progAt(i) - rx) * k} y={ry + (PROG_Y - ry) * k} fill={COLORS.amber} fontFamily={FONTS.mono} fontSize={21}
						opacity={(0.35 + 0.3 * pulse) * (1 - smooth((k - 0.85) / 0.15))}>{b}</text>;
				})}
				<text x={PROG_X} y={PROG_Y} fill={COLORS.amber} fontFamily={FONTS.mono} fontSize={21} opacity={collapse} style={{textShadow: glow(COLORS.amber, 0.6), whiteSpace: 'pre'}}>{PROG_TEXT}<tspan fill={COLORS.dim}>{NOTE}</tspan></text>
				{EDGES.map(([a, b]) => { // the causal graph behind everything
					const [x1, y1] = DAG[a], [x2, y2] = DAG[b], cut = b === 'circuit' && a !== 'circuit';
					const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
					return <g key={a + b} opacity={0.45 + 0.4 * iv}>
						<line x1={x1} y1={y1} x2={x2} y2={y2} stroke={cut ? COLORS.dim : b === 'behavior' ? (iv > 0.5 ? COLORS.lime : COLORS.amber) : COLORS.amber}
							strokeWidth={3} strokeDasharray={cut && iv > 0.5 ? '10 10' : undefined} opacity={cut ? 1 - 0.6 * iv : 1} />
						{cut ? <text x={mx} y={my + 10} fill={COLORS.magenta} fontFamily={FONTS.display} fontSize={34} textAnchor="middle" opacity={iv}>✕</text> : null}
					</g>;
				})}
				{Object.entries(DAG).map(([id, [x, y]]) => {
					const hot = id === 'circuit' ? iv : id === 'behavior' ? smooth((iv - 0.5) * 2) : 0; // intervention, then its effect
					return <g key={id} opacity={0.6 + 0.4 * hot}>
						<circle cx={x} cy={y} r={14 + 6 * hot + 4 * pulse} fill={hot > 0.5 ? COLORS.lime : COLORS.amber} style={{filter: `drop-shadow(0 0 12px ${COLORS.amber})`}} />
						<text x={x} y={y - 26} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={19} textAnchor="middle">{id === 'circuit' && iv > 0.5 ? 'do(circuit := c′)' : id}</text>
					</g>;
				})}
				{Array.from({length: 48}, (_, i) => { // gold rays around the words
					const a = (i / 48) * Math.PI * 2 + local * 0.08, r0 = 260 + 30 * pulse, r1 = 420 + 60 * pulse + (i % 3) * 30;
					return <line key={i} x1={960 + Math.cos(a) * r0} y1={540 + Math.sin(a) * r0 * 0.62} x2={960 + Math.cos(a) * r1} y2={540 + Math.sin(a) * r1 * 0.62}
						stroke={COLORS.amber} strokeWidth={3} opacity={0.18 + 0.2 * pulse} />;
				})}
			</svg>
			{banner ? <div style={{position: 'absolute', top: 575, width: '100%', textAlign: 'center', opacity: banner.on, transform: `scale(${0.9 + 0.1 * banner.on})`}}>
				<div style={{fontFamily: FONTS.display, fontWeight: 900, fontSize: 40, color: COLORS.ink, textShadow: glow(COLORS.amber, 0.9)}}>INTENTIONAL DESIGN</div>
				<div style={{fontFamily: FONTS.mono, fontSize: 18, color: COLORS.amber}}>{banner.v.text} · {banner.v.cite}</div>
			</div> : null}
		</AbsoluteFill>
	);
};
