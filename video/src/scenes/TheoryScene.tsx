/**
 * Verse 3 — "There will be a theory!"
 * Local: the title of Simon, Kunin et al. 2026 (arXiv:2604.21691); five blocks (a)-(e), an accordion: each rises when
 * its direction is sung and widens to show that direction's figure inside it (a card the scene draws itself), while the
 * earlier blocks narrow to a vertical title and a thumbnail; on "mechanics" all five settle side by side. Right: a real
 * scaling-law plot (the "Learning mechanics" and GPT-4 figures sit in the slot above it): Epoch AI's 245 runs extracted from Hoffmann et al. 2022
 * (loss vs parameters, colored by training compute) with the iso-FLOP curves L(N, C/6N) of two published
 * parametric fits (Hoffmann et al. solid, Epoch's re-fit dashed) and their compute-optimal minima, the last one
 * marked "predicted before training". A FALSIFIABLE stamp lands on "falsifiable".
 * Global: the "science" half of the song; numbers from public/vignettes/chinchilla.json (scripts/vignette_data.py).
 * Sources: Hoffmann et al. 2022 (arXiv:2203.15556) Eq. 2 and D = C / 6N; Besiroglu et al. 2024 (arXiv:2404.10102) Table 1.
 */
import React from 'react'; // JSX
import {AbsoluteFill} from 'remotion'; // layer
import {wordTime} from '../lib/timeline'; // keyword timing
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {chinchillaLoss} from '../lib/mathviz'; // L(N, D)
import chin from '../../public/vignettes/chinchilla.json'; // points + both fits
import {cardsOn} from '../stage/shots'; // the cards this scene draws itself
import {CardFace} from '../stage/Shot'; // their face
import type {SceneProps} from './types'; // contract

const BUDGETS = [1e19, 1e20, 1e21]; // iso-FLOP budgets drawn (FLOPs)
/** Local: the five directions of arXiv:2604.21691; each block shows the scene card whose title names its direction. */
const DIRECTIONS = ['solvable settings', 'tractable limits', 'simple laws', 'hyperparameters', 'universal behaviors'];
const BLOCKS = {x: 40, y: 230, w: 1040, h: 520, gap: 10, narrow: 70}; // accordion area (left), inside layout.json's protected region
const WIDE = BLOCKS.w - 4 * (BLOCKS.narrow + BLOCKS.gap); // the open block: 720 px
const ease = (x: number) => smooth(x); // shorthand
/** Local: plot area (right half, under the panel slot). Global: drawn here; stage/anchors.ts wires the slot's figures to it. */
export const PLOT = {x: 1110, y: 520, w: 760, h: 330};
const BOX = PLOT; // plot area
const Ns = Array.from({length: 80}, (_, i) => 10 ** (7.7 + i * (10.3 - 7.7) / 79)); // 5e7 .. 2e10 parameters
const px = (N: number) => BOX.x + ((Math.log10(N) - 7.7) / 2.6) * BOX.w; // log N -> screen x
const py = (L: number) => BOX.y + BOX.h - ((L - 2) / 3) * BOX.h; // loss 2..5 -> screen y
const hue = (C: number) => 280 - ((Math.log10(C) - 18) / 4) * 240; // compute -> color (violet .. lime)

export const TheoryScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t, local, length} = useSceneClock(section); // time
	const falsAt = wordTime(tl, section, /falsifiable/i) ?? section.startS + 0.75 * length; // stamp
	const predAt = wordTime(tl, section, /predict/i) ?? section.startS + 0.85 * length; // prediction marker
	const draw = smooth((local - 1) / (length * 0.5)); // points + curves appear
	const fits = Object.entries(chin.fits) as [string, {E: number; A: number; B: number; alpha: number; beta: number}][];
	const curves = BUDGETS.flatMap((C) => fits.map(([name, f]) => {
		const pts = Ns.filter((N) => C / (6 * N) > N).map((N) => [N, chinchillaLoss(N, C / (6 * N), f)] as const).filter(([, L]) => L < 5); // D = C/6N, keep D > N
		return {C, name, pts, best: pts.reduce((a, b) => (b[1] < a[1] ? b : a))}; // best = compute-optimal N for this budget
	}));
	const target = curves.find((c) => c.C === 1e21 && c.name === 'hoffmann')!.best; // the largest budget's optimum
	const own = cardsOn(tl.vignettes, section.index, t); // the direction cards on now (drawn here)
	const cards = DIRECTIONS.map((d) => tl.vignettes.find((v) => v.sectionIndex === section.index && v.lane === 'scene' && v.title.toLowerCase().includes(d))); // block i's card
	const startOf = (i: number) => cards[i]?.startS ?? section.startS + (i + 1) * length / 7; // when block i is sung
	const lit = DIRECTIONS.map((_, i) => ease((t - startOf(i)) / 0.5)); // block i rises when sung
	const settle = ease((t - (wordTime(tl, section, /mechanics/i) ?? section.startS + 0.6 * length)) / 0.6); // all five side by side
	const open = DIRECTIONS.map((_, i) => ease((t - startOf(i)) / 0.5) * (i < 4 ? 1 - ease((t - startOf(i + 1)) / 0.5) : 1)); // newest is open
	const widths = open.map((o) => (BLOCKS.narrow + (WIDE - BLOCKS.narrow) * o) * (1 - settle) + ((BLOCKS.w - 4 * BLOCKS.gap) / 5) * settle);
	const lefts = widths.map((_, i) => BLOCKS.x + widths.slice(0, i).reduce((a, b) => a + b + BLOCKS.gap, 0));
	const pulse = 0; // blocks keep still; the card bodies animate themselves
	return (
		<AbsoluteFill>
			<div style={{position: 'absolute', left: 60, top: 92, fontFamily: FONTS.display, fontWeight: 900, fontSize: 34, color: COLORS.ink, textShadow: glow(COLORS.cyan, 0.6), opacity: smooth(local / 0.6)}}>
				THERE WILL BE A SCIENTIFIC THEORY OF DEEP LEARNING
				<div style={{fontFamily: FONTS.mono, fontWeight: 400, fontSize: 18, color: COLORS.dim, marginTop: 6, textShadow: 'none'}}>
					five directions: Simon, Kunin et al. 2026 · arXiv:2604.21691 · “learning mechanics”
				</div>
			</div>
			{DIRECTIONS.map((name, i) => { // the accordion: each block rises when sung, opens to its figure, narrows when the next opens
				const w = widths[i], v = cards[i], s = Math.min((w - 20) / 600, (BLOCKS.h - 70) / 350); // card scale: fills the block
				const on = own.find((c) => c.v === v)?.on ?? (v && t > v.endS ? 1 : 0); // the figure stays in its block after its time
				return (
					<div key={i} style={{position: 'absolute', left: lefts[i], top: BLOCKS.y + BLOCKS.h * (1 - lit[i]), width: w, height: BLOCKS.h * lit[i], overflow: 'hidden', borderRadius: 12,
						background: 'linear-gradient(0deg, rgba(34,228,255,0.03), rgba(34,228,255,0.14))', border: `2px solid ${COLORS.cyan}`,
						boxShadow: `0 0 ${18 + 30 * open[i]}px rgba(34,228,255,${0.2 + 0.35 * open[i]})`}}>
						<div style={{position: 'absolute', left: 12, top: 12, fontFamily: FONTS.display, fontWeight: 700, fontSize: w < 400 ? 15 : 20, color: COLORS.ink, whiteSpace: 'nowrap',
							textShadow: glow(COLORS.cyan, 0.4), transformOrigin: 'left top', transform: w < 150 ? `translate(${w / 2 + 2}px, 0) rotate(90deg)` : undefined}}>
							{'(' + 'abcde'[i] + ') ' + name}
						</div>
						{v ? <div style={{position: 'absolute', left: 10, top: w < 150 ? BLOCKS.h - 20 - 350 * s : Math.max(44, (BLOCKS.h - 350 * s) / 2 + 14), width: 600, transformOrigin: 'left top',
							transform: `scale(${s})`, opacity: on}}>
							<CardFace tl={tl} v={v} t={t} accent={COLORS.cyan} pulse={pulse} words={smooth((w - 300) / 120)} />
						</div> : null}
					</div>
				);
			})}
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				<line x1={BOX.x} y1={BOX.y} x2={BOX.x} y2={BOX.y + BOX.h} stroke={COLORS.dim} />
				<line x1={BOX.x} y1={BOX.y + BOX.h} x2={BOX.x + BOX.w} y2={BOX.y + BOX.h} stroke={COLORS.dim} />
				<text x={BOX.x + BOX.w / 2} y={BOX.y + BOX.h + 26} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={16} textAnchor="middle">parameters N (log) · 245 points from Hoffmann et al. 2022 Fig. 4 (extracted by Epoch AI)</text>
				<text x={BOX.x - 12} y={BOX.y + BOX.h / 2} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={16} textAnchor="end">loss</text>
				{chin.points.map(([N, C, L], i) => <circle key={i} cx={px(N)} cy={py(L)} r={3.5} fill={`hsl(${hue(C)} 90% 60%)`} opacity={0.75 * smooth(draw * 3 - (i / chin.points.length) * 2)} />)}
				{curves.map(({C, name, pts, best}) => (
					<g key={`${C}${name}`} opacity={smooth(draw * 2 - 1)}>
						<polyline points={pts.map(([N, L]) => `${px(N)},${py(L)}`).join(' ')} fill="none" stroke={`hsl(${hue(C)} 90% 65%)`} strokeWidth={3} strokeDasharray={name === 'epoch' ? '8 6' : undefined} />
						<circle cx={px(best[0])} cy={py(best[1])} r={6} fill={COLORS.lime} />
					</g>
				))}
				<text x={BOX.x + BOX.w - 4} y={BOX.y + 18} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={15} textAnchor="end" opacity={draw}>L = E + A/N^α + B/D^β · solid: Hoffmann · dashed: Epoch re-fit</text>
				<g opacity={smooth((t - predAt) / 0.4)}>
					<circle cx={px(target[0])} cy={py(target[1])} r={22} fill="none" stroke={COLORS.lime} strokeWidth={4} />
					<text x={px(target[0])} y={py(target[1]) + 46} fill={COLORS.lime} fontFamily={FONTS.mono} fontSize={18} textAnchor="middle">10²¹ FLOPs: best N ≈ {(target[0] / 1e9).toFixed(1)}B, predicted before training</text>
				</g>
			</svg>
			<div style={{position: 'absolute', left: 1150, top: 545, padding: '6px 18px', border: `4px solid ${COLORS.lime}`, borderRadius: 10, fontFamily: FONTS.display, fontSize: 28,
				color: COLORS.lime, transform: `rotate(-5deg) scale(${1.6 - 0.6 * smooth((t - falsAt) / 0.2)})`, opacity: smooth((t - falsAt) / 0.2)}}>
				FALSIFIABLE · QUANTITATIVE
			</div>
		</AbsoluteFill>
	);
};
