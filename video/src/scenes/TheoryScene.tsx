/**
 * Verse 3 — "There will be a theory!"
 * Local: five pillars rise as their keywords are sung (the five research directions of
 * Simon, Kunin et al. 2026, "There Will Be a Scientific Theory of Deep Learning", arXiv:2604.21691),
 * next to a log-log scaling-law plot L(N) = L∞ + A·N^(−α) that draws itself with synthetic points.
 * Global: the "science" half of the song: falsifiable, quantitative predictions.
 * Plot data are synthetic (illustrative), not fitted to any real model.
 */
import React from 'react'; // JSX
import {AbsoluteFill, random} from 'remotion'; // layer + RNG
import {beatPulse, wordTime} from '../lib/timeline'; // keyword timing
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import type {SceneProps} from './types'; // contract

const PILLARS: [string, RegExp][] = [ // label, triggering keyword in the verse
	['solvable idealized settings', /solve/i],
	['tractable limits (width → ∞)', /limits|infinity/i],
	['simple laws for macroscopic observables', /laws|scaling/i],
	['theories of hyperparameters', /hyperparameter/i],
	['universal behaviors', /universal/i],
];
const LAW = (x: number) => 0.25 + 2.2 * Math.pow(10, -0.35 * x); // L(N) with log10 N = x in [0, 6]

export const TheoryScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t, local, length} = useSceneClock(section); // time
	const pulse = beatPulse(tl.beats, t); // beat kick
	const times = PILLARS.map(([, re], i) => wordTime(tl, section, re) ?? section.startS + (i + 1) * length / 7); // reveal times
	const falsAt = wordTime(tl, section, /falsifiable/i) ?? section.startS + 0.75 * length; // stamp
	const predAt = wordTime(tl, section, /predict/i) ?? section.startS + 0.85 * length; // prediction marker
	const draw = smooth((local - 1) / (length * 0.7)); // curve drawing progress
	const px = (x: number) => 1080 + (x / 6) * 700; // plot x (log10 N) -> screen
	const py = (L: number) => 820 - (Math.log10(L) + 0.7) / 1.2 * 520; // plot y (log10 L) -> screen
	const curve = Array.from({length: 61}, (_, i) => i / 10).filter((x) => x <= 6 * draw).map((x) => `${px(x)},${py(LAW(x))}`).join(' ');
	return (
		<AbsoluteFill>
			<div style={{position: 'absolute', left: 70, top: 100, fontFamily: FONTS.display, fontWeight: 900, fontSize: 46, color: COLORS.ink, textShadow: glow(COLORS.cyan, 0.6), opacity: smooth(local / 0.6)}}>
				THERE WILL BE A SCIENTIFIC THEORY OF DEEP LEARNING
				<div style={{fontFamily: FONTS.mono, fontWeight: 400, fontSize: 20, color: COLORS.dim, marginTop: 8, textShadow: 'none'}}>
					five directions — Simon, Kunin et al. 2026 · arXiv:2604.21691 · “learning mechanics”
				</div>
			</div>
			{PILLARS.map(([label], i) => {
				const a = smooth((t - times[i]) / 0.5); // rise
				const h = 420 * a; // pillar height
				return (
					<div key={i} style={{position: 'absolute', left: 90 + i * 185, top: 860 - h, width: 120, height: h,
						background: `linear-gradient(0deg, rgba(34,228,255,0.05), ${COLORS.cyan})`, boxShadow: `0 0 ${20 + 20 * pulse * a}px ${COLORS.cyan}`, borderRadius: 6}}>
						<div style={{position: 'absolute', bottom: h + 14, width: 170, left: -25, textAlign: 'center', fontFamily: FONTS.body, fontWeight: 600, fontSize: 21, color: COLORS.ink, opacity: a}}>{label}</div>
					</div>
				);
			})}
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				<line x1={px(0)} y1={py(3.2)} x2={px(0)} y2={830} stroke={COLORS.dim} /> {/* y axis */}
				<line x1={px(0) - 10} y1={830} x2={px(6)} y2={830} stroke={COLORS.dim} /> {/* x axis */}
				<text x={px(3)} y={875} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={20} textAnchor="middle">log N (parameters · data · compute)</text>
				<text x={px(0) - 20} y={py(1)} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={20} textAnchor="end">log L</text>
				{Array.from({length: 13}, (_, i) => { const x = i / 2; const show = x <= 6 * draw; // synthetic measurements
					return <circle key={i} cx={px(x)} cy={py(LAW(x) * (1 + (random(`d${i}`) - 0.5) * 0.12))} r={7} fill={COLORS.magenta} opacity={show ? 0.9 : 0} />; })}
				<polyline points={curve} fill="none" stroke={COLORS.amber} strokeWidth={5} style={{filter: `drop-shadow(0 0 8px ${COLORS.amber})`}} />
				<text x={px(3.4)} y={py(LAW(1.2))} fill={COLORS.amber} fontFamily={FONTS.mono} fontSize={30} opacity={draw}>L(N) = L∞ + A·N^(−α)</text>
				<g opacity={smooth((t - predAt) / 0.4)}>
					<circle cx={px(5.6)} cy={py(LAW(5.6))} r={16} fill="none" stroke={COLORS.lime} strokeWidth={4} /> {/* predicted point */}
					<text x={px(5.6)} y={py(LAW(5.6)) - 30} fill={COLORS.lime} fontFamily={FONTS.mono} fontSize={22} textAnchor="middle">predicted before training</text>
				</g>
			</svg>
			<div style={{position: 'absolute', left: 1180, top: 230, padding: '10px 22px', border: `4px solid ${COLORS.lime}`, borderRadius: 10, fontFamily: FONTS.display, fontSize: 34,
				color: COLORS.lime, transform: `rotate(-6deg) scale(${1.6 - 0.6 * smooth((t - falsAt) / 0.2)})`, opacity: smooth((t - falsAt) / 0.2)}}>
				FALSIFIABLE · QUANTITATIVE
			</div>
		</AbsoluteFill>
	);
};
