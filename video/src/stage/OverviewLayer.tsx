/**
 * The finale's overview and its celebration (v1.6.0).
 * Local: from the rewind's landing downbeat to the end: gold rays turn behind a mosaic of ten live tiles (frozen copies
 * of the video at each section's richest moment, playing on at half speed, flying out of the token; stage/overview.ts),
 * every figure title of the song orbits the centre in three lanes (the far side faint), fireworks burst on each downbeat, ARC-palette
 * confetti falls, glitter twinkles, and the whole mosaic punches in on the beat. Everything is a pure function of the
 * frame (seeded random), so it renders in parallel.
 * Global: Anthem draws it under the live World, whose OutroScene puts the token and the statement in the free centre.
 * Sources: https://www.remotion.dev/docs/freeze ; ARC palette from vignettes/finale.tsx (Chollet 2019, arXiv:1911.01547).
 */
import React from 'react'; // JSX
import {AbsoluteFill, Freeze, random, useCurrentFrame, useVideoConfig} from 'remotion'; // clock + freeze + RNG
import {beatPulse, type Timeline} from '../lib/timeline'; // data + beat kick
import {COLORS, FONTS, smooth} from '../lib/theme'; // look
import {World} from '../World'; // the video at a frame
import {SCENES} from '../scenes'; // tile captions
import {PAL} from '../vignettes/finale'; // ARC colours
import {sceneLayout} from './layout'; // each scene's accent
import {CENTRE, FADE_S, SLOW, overviewPlan, tilePose} from './overview'; // the mosaic

const C = {x: CENTRE[0] + CENTRE[2] / 2, y: CENTRE[1] + CENTRE[3] / 2}; // the centre of the mosaic
const COLS = PAL.slice(1); // bright ARC colours (cyan, magenta, amber, lime)
const LANES = [{rx: 900, ry: 470, w: 0.11}, {rx: 700, ry: 360, w: -0.08}, {rx: 520, ry: 260, w: 0.14}]; // orbits of the figure titles

export const Overview: React.FC<{tl: Timeline; start: number}> = ({tl, start}) => {
	const frame = useCurrentFrame(); // absolute frame
	const {fps} = useVideoConfig(); // fps
	const t = frame / fps, since = t - start; // seconds into the overview
	if (since < 0) return null;
	const plan = overviewPlan(tl, start);
	const beat = beatPulse(tl.beats, t), bar = beatPulse(tl.downbeats, t, 0.25); // beat and downbeat kicks
	const fade = smooth((t - (plan.end - FADE_S)) / FADE_S); // to black at the very end
	const titles = tl.vignettes.filter((v) => v.startS < start).map((v) => v.title); // every figure of the song
	const bursts = tl.downbeats.filter((d) => d >= start - 1e-6 && t - d >= 0 && t - d < 1.6) // fireworks of the downbeats in the last 1.6 s
		.flatMap((d) => [0, 1].map((j) => ({d, j, x: 160 + random(`fwx${d}-${j}`) * 1600, y: 110 + random(`fwy${d}-${j}`) * 420})));
	return (
		<AbsoluteFill style={{opacity: 1 - fade}}>
			<svg width={1920} height={1080} style={{position: 'absolute'}}>{/* gold rays turning behind the mosaic */}
				<defs><radialGradient id="ray"><stop offset="0" stopColor={COLORS.amber} stopOpacity={0.9} /><stop offset="1" stopColor={COLORS.amber} stopOpacity={0} /></radialGradient></defs>
				{Array.from({length: 24}, (_, i) => {
					const a = (i / 24) * Math.PI * 2 + since * 0.1, da = 0.045;
					return <polygon key={i} points={`${C.x},${C.y} ${C.x + Math.cos(a - da) * 1500},${C.y + Math.sin(a - da) * 1500} ${C.x + Math.cos(a + da) * 1500},${C.y + Math.sin(a + da) * 1500}`}
						fill="url(#ray)" opacity={(0.25 + 0.4 * bar) * smooth(since / 0.5)} />;
				})}
			</svg>
			<AbsoluteFill style={{transform: `scale(${1 + 0.025 * bar})`}}>{/* the mosaic, punched on each downbeat */}
				{plan.tiles.map((tile) => {
					const p = tilePose(tile, start, t), [, , w, h] = tile.rect, sc = Math.max(w / 1920, h / 1080); // cover the cell
					const s = tl.sections[tile.sectionIndex], accent = sceneLayout(s.scene).accent;
					return p.k <= 0 ? null : (
						<div key={tile.sectionIndex} style={{position: 'absolute', left: p.x - w / 2, top: p.y - h / 2, width: w, height: h, overflow: 'hidden', borderRadius: 10,
							border: `2px solid ${accent}`, boxShadow: `0 0 ${14 + 22 * beat}px ${accent}`, background: COLORS.bg,
							transform: `scale(${0.06 + 0.94 * p.k}) rotate(${(1 - p.k) * (tile.delay * 900 - 180)}deg)`}}>
							<div style={{position: 'absolute', left: w / 2 - 960 * sc, top: h / 2 - 540 * sc, width: 1920, height: 1080, transform: `scale(${sc})`, transformOrigin: 'top left'}}>
								<Freeze frame={Math.round((tile.src + since * SLOW) * fps)}>
									<World tl={tl} lyrics={false} />
								</Freeze>
							</div>
							<div style={{position: 'absolute', left: 8, bottom: 6, padding: '2px 8px', borderRadius: 6, background: 'rgba(4,5,13,0.8)', fontFamily: FONTS.mono, fontSize: 14, color: accent}}>
								§{String(s.index + 1).padStart(2, '0')} {s.label.toUpperCase()} · {(SCENES[s.scene] ?? SCENES.default).caption}
							</div>
						</div>
					);
				})}
			</AbsoluteFill>
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				{titles.map((title, i) => { // every figure title, orbiting the centre in three lanes
					const lane = LANES[i % 3], n = Math.ceil(titles.length / 3), a = (Math.floor(i / 3) / n) * Math.PI * 2 + since * lane.w + i;
					const open = smooth((since - 0.2) / 0.8), depth = (Math.sin(a) + 1) / 2, x = C.x + Math.cos(a) * lane.rx * open, y = C.y + Math.sin(a) * lane.ry * open; // spread out after the burst
					return <text key={i} x={x} y={y} fill={COLS[i % 4]} fontFamily={FONTS.display} fontWeight={700} fontSize={11 + 8 * depth} textAnchor="middle"
						opacity={(0.08 + 0.72 * depth ** 2) * open} style={{paintOrder: 'stroke', stroke: COLORS.bg, strokeWidth: 4}}>{title}</text>;
				})}
				{bursts.map(({d, j, x, y}) => { const tau = t - d; return Array.from({length: 40}, (_, k) => { // a firework: sparks under gravity with short trails
					const a = (k / 40) * Math.PI * 2 + random(`fa${d}-${j}-${k}`) * 0.15, v = 240 + 200 * random(`fv${d}-${j}-${k}`);
					const at = (u: number) => [x + Math.cos(a) * v * u, y + Math.sin(a) * v * u + 160 * u * u]; // ballistic path (px, s)
					const [x1, y1] = at(Math.max(0, tau - 0.08)), [x2, y2] = at(tau);
					return <line key={`${d}-${j}-${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLS[(k + j) % 4]} strokeWidth={3} strokeLinecap="round" opacity={1 - tau / 1.6} />;
				}); })}
				{Array.from({length: 150}, (_, i) => { // ARC confetti falling and spinning
					const v = 110 + 170 * random(`cv${i}`), x = random(`cx${i}`) * 1920 + 40 * Math.sin(since * 2 + i), y = ((since * v + random(`cy${i}`) * 1140) % 1140) - 30;
					return <rect key={i} x={-7} y={-4} width={14} height={8} fill={COLS[i % 4]} opacity={0.9 * smooth(since / 0.6)}
						transform={`translate(${x} ${y}) rotate(${since * 300 * (random(`cr${i}`) - 0.5) + i * 37})`} />;
				})}
				{Array.from({length: 120}, (_, i) => { // glitter: four-point twinkles
					const g = Math.max(0, Math.sin(since * (3 + 4 * random(`gw${i}`)) + 6.28 * random(`gp${i}`))) ** 12, s = 6 + 10 * random(`gs${i}`) * g;
					const x = random(`gx${i}`) * 1920, y = 80 + random(`gy${i}`) * 960;
					return g < 0.05 ? null : <path key={i} d={`M${x - s} ${y}L${x} ${y - 1.5}L${x + s} ${y}L${x} ${y + 1.5}ZM${x} ${y - s}L${x + 1.5} ${y}L${x} ${y + s}L${x - 1.5} ${y}Z`}
						fill={i % 3 ? '#ffffff' : COLORS.amber} opacity={g} />;
				})}
			</svg>
		</AbsoluteFill>
	);
};
