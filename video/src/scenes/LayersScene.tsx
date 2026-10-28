/**
 * Verse 1 — "a matrix and a bend, repeated without end": a forward pass on the lyric itself.
 * Local: the camera flies through a stack of layers (grids of neurons) joined by sparse weight lines; an
 * activation wave travels forward layer by layer and pulses on beats. Concrete layers on top of that:
 *  - the sung line appears as a row of real GPT-2 token chips (ids from public/vignettes/lyric_tokens.json)
 *    with attention arcs from the newest token back to the earlier ones (schematic weights);
 *  - each new token drops into the tunnel;
 *  - Epoch AI's model milestones (Mark I perceptron 1957 ... Switch-C 1.57T, PaLM 2022) are mile markers the camera flies past;
 *  - on "gradient", the wave reverses and turns magenta: the backward pass.
 *  - "Nobody drew the plan": Sutton's Bitter Lesson rolls along the tunnel floor (a card the scene draws itself).
 *  The figure panels (W·h, the bend, the scale, ReLU regions, induction heads...) sit on the tunnel's left and right,
 *  wired to the layer stack.
 * Global: introduces depth = composition of linear maps and nonlinearities, which the landscape scene then trains.
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random} from 'remotion'; // layer + seeded RNG
import {activeWordIndex, beatPulse, featureAt, lineAt, wordTime} from '../lib/timeline'; // audio reactivity + lyrics
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {CameraRig, GlowLines, GlowPoints, Stage, projectToScreen, rgb} from '../components/three'; // 3D blocks
import {human} from '../vignettes/primitives'; // 1.57T-style numbers
import lyricTokens from '../../public/vignettes/lyric_tokens.json'; // GPT-2 ids of every lyric word
import scaleData from '../../public/vignettes/scale.json'; // Epoch AI milestones
import {cardsOn} from '../stage/shots'; // the cards this scene draws itself
import type {SceneProps} from './types'; // contract

const LAYERS = 16; // depth of the stack
const COLS = 12; // neurons per row
const ROWS = 7; // rows per layer
const GAP = 6; // distance between layers (world units)
const EDGES = 90; // weight lines drawn per layer pair
const MARKS = scaleData.marks; // parameter milestones in time order
const NAMES: Record<string, string> = {'Perceptron Mark I': 'Mark I perceptron', 'GPT-2 (1.5B)': 'GPT-2', 'GPT-3 175B (davinci)': 'GPT-3', 'PaLM (540B)': 'PaLM', Switch: 'Switch-C'}; // short labels
const TOKENS = lyricTokens as Record<string, number[][]>; // line index -> ids per word

export const LayersScene: React.FC<SceneProps> = ({tl, section}) => {
	const {frame, fps, t, local, progress} = useSceneClock(section); // time
	const energy = featureAt(tl.energy, fps, t); // loudness
	const pulse = beatPulse(tl.beats, t); // beat kick
	const gradAt = wordTime(tl, section, /gradient/i) ?? section.endS; // backward pass starts here
	const backward = t >= gradAt; // after "gradient": the wave runs backwards
	const grid = useMemo(() => { // static neuron positions: layer l at z = -l*GAP
		const p: number[] = [];
		for (let l = 0; l < LAYERS; l++) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) p.push((c - (COLS - 1) / 2) * 1.1, (r - (ROWS - 1) / 2) * 1.1, -l * GAP);
		return p;
	}, []);
	const edges = useMemo(() => { // seeded sparse connectivity between consecutive layers
		const e: [number, number][] = [];
		for (let l = 0; l < LAYERS - 1; l++) for (let k = 0; k < EDGES; k++) {
			const a = Math.floor(random(`ea${l}-${k}`) * ROWS * COLS); // source neuron in layer l
			const b = Math.floor(random(`eb${l}-${k}`) * ROWS * COLS); // target neuron in layer l+1
			e.push([l * ROWS * COLS + a, (l + 1) * ROWS * COLS + b]);
		}
		return e;
	}, []);
	const {pos, col, lpos, lcol} = useMemo(() => { // per-frame colors (activation wave)
		const run = (t * 2.2) % (LAYERS + 4); // wave position
		const wave = backward ? LAYERS - run : run; // forward, or backward after "gradient"
		const lit = backward ? COLORS.magenta : COLORS.cyan; // gradients in magenta
		const n = grid.length / 3; // neuron count
		const col = new Float32Array(n * 3); // rgb per neuron
		const act = new Float32Array(n); // activation per neuron (for edges)
		for (let i = 0; i < n; i++) {
			const l = Math.floor(i / (ROWS * COLS)); // layer index
			const front = Math.exp(-((l - wave) ** 2) / 1.5); // gaussian wave front
			const h = Math.max(0, Math.sin(i * 12.9898 + t * 1.7)); // ReLU of a pseudo pre-activation
			act[i] = front * h; // sparse, moving activation
			const [r, g, b] = act[i] > 0.15 ? rgb(lit, 0.4 + 1.6 * act[i] * (1 + pulse)) : rgb(COLORS.violet, 0.35 + 0.3 * energy);
			col.set([r, g, b], i * 3);
		}
		const lpos = new Float32Array(edges.length * 6); // two xyz per edge
		const lcol = new Float32Array(edges.length * 6); // two rgb per edge
		edges.forEach(([a, b], k) => {
			lpos.set(grid.slice(a * 3, a * 3 + 3), k * 6); // start vertex
			lpos.set(grid.slice(b * 3, b * 3 + 3), k * 6 + 3); // end vertex
			const s = 0.08 + 0.9 * Math.max(act[a], act[b]); // lit where signal flows
			const c = rgb(backward ? COLORS.amber : COLORS.magenta, s);
			lcol.set([...c, ...c], k * 6);
		});
		return {pos: new Float32Array(grid), col, lpos, lcol};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [frame]);
	const camZ = 14 - progress * (LAYERS * GAP * 0.8); // fly forward through ~80% of the stack
	const cam: [number, number, number] = [Math.sin(local * 0.4) * 3, Math.cos(local * 0.3) * 1.5 + 1, camZ]; // shared with the label projection
	const target: [number, number, number] = [0, 0, camZ - 20];
	const markers = MARKS.map((m, i) => { // mile markers along the tunnel, alternating sides
		const z = 4 - i * 9; // world depth of marker i
		const q = projectToScreen([i % 2 ? 8 : -8, 0, z], cam, target); // at the tunnel walls: near ones sit at the frame edges, clear of the hero
		const depth = camZ - z; // distance in front of the camera
		return {m, ...q, depth, s: Math.min(1.6, 14 / Math.max(1, depth))};
	}).filter((k) => k.visible && k.depth > 1.5 && k.depth < 40);
	const line = lineAt(tl, t); // the line being sung
	const ids = line ? TOKENS[String(line.index)] ?? [] : []; // its GPT-2 ids
	const sung = line ? Math.min(line.words.length, activeWordIndex(line, t) + 1) : 0; // tokens so far
	const chipX = (k: number, n: number) => 960 + (k - (n - 1) / 2) * 128; // chip centres (11 words fit inside the frame's margins)
	const quote = cardsOn(tl.vignettes, section.index, t).find((c) => c.v.title === 'Nobody drew the plan'); // the Bitter Lesson
	return (
		<AbsoluteFill>
			<Stage>
				<CameraRig position={cam} target={target} />
				<GlowLines positions={lpos} colors={lcol} opacity={0.55} />
				<GlowPoints positions={pos} colors={col} size={0.45 + 0.15 * pulse} />
			</Stage>
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				{markers.map((k) => ( // milestone signposts: name, year, parameters (Epoch AI)
					<g key={k.m.name} transform={`translate(${k.x} ${k.y}) scale(${k.s})`} opacity={Math.min(1, (k.depth - 1.5) / 3, (40 - k.depth) / 8)}>
						<rect x={-92} y={-30} width={184} height={50} rx={8} fill="rgba(4,5,13,0.75)" stroke={COLORS.amber} />
						<text x={0} y={-8} fill={COLORS.amber} fontFamily={FONTS.display} fontSize={15} textAnchor="middle">{NAMES[k.m.name] ?? k.m.name}</text>
						<text x={0} y={12} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={13} textAnchor="middle">{Math.floor(k.m.year)} · {human(k.m.params)}</text>
					</g>
				))}
				{line && sung > 0 ? line.words.slice(0, sung).map((w, k) => { // token chips of the sung line + attention arcs
					const x = chipX(k, line.words.length), y = 150;
					const age = t - w.startS; // seconds since this token arrived
					const newest = k === sung - 1;
					return (
						<g key={k} opacity={smooth(age / 0.15)}>
							{newest ? line.words.slice(0, k).map((_, j) => ( // the newest token attends to earlier ones (schematic weights)
								<path key={j} d={`M ${x} ${y - 28} Q ${(x + chipX(j, line.words.length)) / 2} ${y - 50 - Math.min(30, (k - j) * 4)} ${chipX(j, line.words.length)} ${y - 28}`}
									fill="none" stroke={COLORS.cyan} strokeWidth={1 + 3 * random(`att${line.index}${k}${j}`)} opacity={0.35 + 0.5 * random(`atw${line.index}${k}${j}`)} />
							)) : null}
							<rect x={x - 60} y={y - 26} width={120} height={52} rx={8} fill="rgba(4,5,13,0.8)" stroke={newest ? COLORS.cyan : COLORS.violet} strokeWidth={newest ? 2.5 : 1.5} />
							<text x={x} y={y - 3} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={17} textAnchor="middle">{w.text.replace(/[(),!.]/g, '')}</text>
							<text x={x} y={y + 17} fill={COLORS.cyan} fontFamily={FONTS.mono} fontSize={12} textAnchor="middle">{(ids[k] ?? []).join(' ')}</text>
							{newest && age < 0.9 ? <circle cx={x + (960 - x) * smooth(age / 0.9)} cy={y + (470 - y) * smooth(age / 0.9)} r={10 * (1 - smooth(age / 0.9))}
								fill={COLORS.cyan} style={{filter: `drop-shadow(0 0 8px ${COLORS.cyan})`}} /> : null}
						</g>
					);
				}) : null}
				<text x={100} y={140} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={13} opacity={line ? 1 : 0}>GPT-2 ids</text>
				<text x={100} y={160} fill={backward ? COLORS.magenta : COLORS.cyan} fontFamily={FONTS.mono} fontSize={13} opacity={line ? 1 : 0}>{backward ? '← ∂L/∂W' : 'forward →'}</text>
			</svg>
			{quote ? <div style={{position: 'absolute', left: 360, width: 1200, top: 660, height: 200, perspective: 500, opacity: quote.on}}> {/* on the tunnel floor */}
				<div style={{transform: `rotateX(58deg) translateY(${120 - (t - quote.v.startS) * 26}px)`, transformOrigin: 'center bottom', textAlign: 'center',
					fontFamily: FONTS.display, fontWeight: 700, fontSize: 40, lineHeight: 1.15, color: COLORS.amber, textShadow: glow(COLORS.amber, 0.7)}}>
					{quote.v.text.split('\n').map((l, i) => <div key={i}>{l}</div>)}
					<div style={{fontFamily: FONTS.mono, fontSize: 20, color: COLORS.dim, textShadow: 'none'}}>{quote.v.cite}</div>
				</div>
			</div> : null}
		</AbsoluteFill>
	);
};
