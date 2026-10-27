/**
 * Building blocks of the figure cards.
 * Local: `Card` (the glowing frame: FIG number, provenance badge, title, body, caption, citation, with a slam-in
 * entrance and a slide-out exit) and small SVG primitives that cards compose: `Plot` (progressively drawn
 * polylines on linear/log axes), `Heatmap`, `Graph`, `Bars` and `Formula`.
 * Global: every card in video/src/vignettes/*.tsx is a few lines on top of these, so all cards share one look
 * and every visual stays a pure function of the frame. Sources: evolvePath https://www.remotion.dev/docs/paths/evolve-path ,
 * random() https://www.remotion.dev/docs/random , SVG https://developer.mozilla.org/en-US/docs/Web/SVG
 */
import React from 'react'; // JSX
import {random} from 'remotion'; // seeded tilt
import {evolvePath} from '@remotion/paths'; // stroke-dash animation of a path
import type {Timeline, Vignette} from '../lib/timeline'; // card record
import {BADGE_COLORS, COLORS, FONTS, glow, smooth} from '../lib/theme'; // look

/** Local: what every card body receives. Global: the contract of video/src/vignettes/index.ts. */
export type BodyProps = {v: Vignette; tl: Timeline; t: number; local: number; p: number; w: number; h: number; pulse: number; accent: string};

const PAD = 12; // inner padding (px)
const HEAD = 24; // FIG / badge row
const FOOT = 18; // citation row
const lines = (text: string, size: number, width: number) => Math.max(1, Math.ceil((text.length * size * 0.52) / width)); // wrapped line estimate

/** Local: layout of a card's text blocks for a given box. Global: tells the body how much room it has. */
export const cardLayout = (v: Vignette, w: number, h: number, showText: boolean) => {
	const titleSize = w < 300 ? 18 : 22; // narrow pillars get a smaller title
	const textSize = w < 300 ? 13 : 15;
	const titleH = lines(v.title, titleSize, w - 2 * PAD) * titleSize * 1.15;
	const textH = showText && v.text ? lines(v.text, textSize, w - 2 * PAD) * textSize * 1.3 : 0;
	return {titleSize, textSize, bodyW: w - 2 * PAD, bodyH: Math.max(40, h - 2 * PAD - HEAD - titleH - textH - FOOT - 14)};
};

/** Local: the card frame with entrance/exit motion. Global: drawn by VignetteLayer for every active card. */
export const Card: React.FC<{v: Vignette; fig: number; t: number; box: [number, number, number, number]; pulse: number; accent: string; showText: boolean; children: React.ReactNode}> = ({
	v, fig, t, box, pulse, accent, showText, children,
}) => {
	const [x, y, w, h] = box;
	const enter = smooth((t - v.startS) / 0.22); // 0 -> 1 slam in
	const leave = smooth((v.endS - t) / 0.25); // 1 -> 0 slide out
	const tilt = (random(`tilt${v.id}${v.startS}`) - 0.5) * 4 * (1 - enter); // seeded ±2° that settles to 0
	const {titleSize, textSize} = cardLayout(v, w, h, showText);
	const badge = BADGE_COLORS[v.badge];
	return (
		<div style={{position: 'absolute', left: x, top: y, width: w, height: h, padding: PAD, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
			background: 'linear-gradient(160deg, rgba(10,12,30,0.96), rgba(4,5,13,0.95))', border: `2px solid ${accent}`, borderRadius: 14,
			boxShadow: `0 0 ${10 + 16 * pulse}px ${accent}66, inset 0 0 24px ${accent}22`, opacity: enter * leave,
			transform: `translateY(${(1 - leave) * 24}px) scale(${1.12 - 0.12 * enter}) rotate(${tilt}deg)`, overflow: 'hidden'}}>
			<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: HEAD}}>
				<span style={{fontFamily: FONTS.display, fontWeight: 700, fontSize: w < 300 ? 11 : 14, color: accent, letterSpacing: '0.12em'}}>{w < 300 ? '' : 'FIG. '}{fig}</span>
				<span style={{fontFamily: FONTS.mono, fontSize: w < 300 ? 9 : 12, color: COLORS.bg, background: badge, borderRadius: 9, padding: w < 300 ? '1px 5px' : '2px 9px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap'}}>{v.badge}</span>
			</div>
			<div style={{fontFamily: FONTS.body, fontWeight: 600, fontSize: titleSize, lineHeight: 1.15, color: COLORS.ink, textShadow: glow(accent, 0.25), marginTop: 2}}>{v.title}</div>
			<div style={{flex: 1, position: 'relative', marginTop: 6, minHeight: 0}}>{children}</div>
			{showText && v.text ? <div style={{fontFamily: FONTS.body, fontSize: textSize, lineHeight: 1.3, color: COLORS.ink, opacity: 0.86, marginTop: 4}}>{v.text}</div> : null}
			<div style={{fontFamily: FONTS.mono, fontSize: 11, color: COLORS.dim, height: FOOT, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{v.cite}</div>
		</div>
	);
};

type Series = {pts: [number, number][]; color: string; width?: number; dash?: string; label?: string}; // one polyline
type Axis = {log?: boolean; domain: [number, number]; label?: string}; // axis config

/** Local: data -> pixel mapping for one axis. Global: shared by Plot and the cards that place extra marks. */
export const scale = (a: Axis, size: number, flip = false) => (v: number) => {
	const f = (u: number) => (a.log ? Math.log10(u) : u); // log axes work in decades
	const r = (f(v) - f(a.domain[0])) / (f(a.domain[1]) - f(a.domain[0])); // 0..1
	return flip ? size - r * size : r * size;
};

/** Local: polylines on linear/log axes, drawn left to right by `draw` (0..1), with axis labels.
 * Global: loss curves, spectra, scaling laws, densities. */
export const Plot: React.FC<{w: number; h: number; x: Axis; y: Axis; series: Series[]; draw?: number; children?: (sx: (v: number) => number, sy: (v: number) => number) => React.ReactNode}> = ({
	w, h, x, y, series, draw = 1, children,
}) => {
	const L = 34, B = 20; // room for the y label and the x label
	const sx = (v: number) => L + scale(x, w - L - 6)(v); // data -> px
	const sy = (v: number) => scale(y, h - B - 4, true)(v) + 4;
	return (
		<svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
			<line x1={L} y1={h - B} x2={w - 4} y2={h - B} stroke={COLORS.dim} strokeWidth={1.5} />
			<line x1={L} y1={4} x2={L} y2={h - B} stroke={COLORS.dim} strokeWidth={1.5} />
			{x.label ? <text x={(L + w) / 2} y={h - 4} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={12} textAnchor="middle">{x.label}</text> : null}
			{y.label ? <text x={12} y={(h - B) / 2} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={12} textAnchor="middle" transform={`rotate(-90 12 ${(h - B) / 2})`}>{y.label}</text> : null}
			{series.map((s, i) => {
				const d = s.pts.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && (!x.log || a > 0) && (!y.log || b > 0))
					.map(([a, b], k) => `${k ? 'L' : 'M'} ${sx(Math.min(Math.max(a, x.domain[0]), x.domain[1])).toFixed(1)} ${sy(Math.min(Math.max(b, y.domain[0]), y.domain[1])).toFixed(1)}`).join(' ');
				if (!d) return null;
				const evo = evolvePath(Math.max(0.001, Math.min(1, draw)), d); // progressive stroke
				return <path key={i} d={d} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.5} strokeDasharray={s.dash ?? evo.strokeDasharray}
					strokeDashoffset={s.dash ? 0 : evo.strokeDashoffset} strokeLinejoin="round" style={{filter: `drop-shadow(0 0 4px ${s.color})`}} />;
			})}
			{children ? children(sx, sy) : null}
		</svg>
	);
};

/** Local: a value -> color ramp from the background through `lo` to `hi`. Global: heatmaps. */
const ramp = (r: number, hi: string) => `color-mix(in srgb, ${hi} ${Math.round(100 * Math.min(1, Math.max(0, r)))}%, #0b0e24)`;

/** Local: grid of cells colored by value, revealed row by row; optional ring on chosen cells.
 * Global: induction scores, refusal scores, patching. */
export const Heatmap: React.FC<{w: number; h: number; z: number[][]; color: string; reveal?: number; lo?: number; hi?: number; rings?: [number, number][]; xLabel?: string; yLabel?: string}> = ({
	w, h, z, color, reveal = 1, lo, hi, rings = [], xLabel, yLabel,
}) => {
	const flat = z.flat();
	const min = lo ?? Math.min(...flat), max = hi ?? Math.max(...flat); // color range
	const L = yLabel ? 18 : 0, B = xLabel ? 16 : 0; // label room
	const cw = (w - L) / z[0].length, ch = (h - B) / z.length; // cell size
	return (
		<svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0}}>
			{z.map((row, r) => row.map((v, c) => (
				<rect key={`${r}-${c}`} x={L + c * cw} y={r * ch} width={cw - 1} height={ch - 1} rx={2}
					fill={ramp((v - min) / (max - min || 1), color)} opacity={smooth(reveal * (z.length + 2) - r)} />
			)))}
			{rings.map(([r, c], i) => <rect key={i} x={L + c * cw - 1} y={r * ch - 1} width={cw + 1} height={ch + 1} fill="none" stroke={COLORS.ink} strokeWidth={2} opacity={reveal} />)}
			{xLabel ? <text x={L + (w - L) / 2} y={h - 2} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={12} textAnchor="middle">{xLabel}</text> : null}
			{yLabel ? <text x={10} y={(h - B) / 2} fill={COLORS.dim} fontFamily={FONTS.mono} fontSize={12} textAnchor="middle" transform={`rotate(-90 10 ${(h - B) / 2})`}>{yLabel}</text> : null}
		</svg>
	);
};

export type GNode = {id: string; label: string; x: number; y: number; color?: string; r?: number; below?: boolean}; // x, y in 0..1; label lines split on \n
/** Local: labelled nodes and weighted arrows; edges light up in order as `reveal` goes 0 -> 1.
 * Global: attribution graphs, IOI, causal DAGs. */
export const Graph: React.FC<{w: number; h: number; nodes: GNode[]; edges: {s: string; t: string; w?: number; color?: string; cut?: boolean; bend?: number}[]; reveal?: number; fontSize?: number}> = ({
	w, h, nodes, edges, reveal = 1, fontSize = 12,
}) => {
	const pos = Object.fromEntries(nodes.map((n) => [n.id, {x: 20 + n.x * (w - 40), y: 14 + n.y * (h - 28)}])); // node centres (px)
	const wmax = Math.max(1e-9, ...edges.map((e) => Math.abs(e.w ?? 1)));
	return (
		<svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
			<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.ink} /></marker></defs>
			{edges.map((e, i) => {
				const a = pos[e.s], b = pos[e.t];
				if (!a || !b) return null;
				const on = smooth(reveal * (edges.length + 1) - i); // staggered reveal
				const bend = e.bend ?? 0.12; // gentle curve so opposite edges do not overlap
				const mx = (a.x + b.x) / 2 - (b.y - a.y) * bend, my = (a.y + b.y) / 2 + (b.x - a.x) * bend; // control point off the chord
				const d = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
				const evo = evolvePath(Math.max(0.001, on), d); // grows from source to target
				return <path key={i} d={d} fill="none" stroke={e.cut ? '#ff5470' : e.color ?? COLORS.cyan} strokeWidth={1.5 + 4 * Math.abs(e.w ?? 1) / wmax}
					strokeDasharray={e.cut ? '6 6' : evo.strokeDasharray} strokeDashoffset={e.cut ? 0 : evo.strokeDashoffset} opacity={0.35 + 0.6 * on} markerEnd={on > 0.95 ? 'url(#arr)' : undefined} />;
			})}
			{nodes.map((n) => {
				const c = pos[n.id];
				return (
					<g key={n.id}>
						<circle cx={c.x} cy={c.y} r={n.r ?? 6} fill={n.color ?? COLORS.amber} style={{filter: `drop-shadow(0 0 5px ${n.color ?? COLORS.amber})`}} />
						<text x={c.x} y={n.below ? c.y + (n.r ?? 6) + fontSize + 2 : c.y - (n.r ?? 6) - 4 - (n.label.split('\n').length - 1) * fontSize} fill={COLORS.ink} fontFamily={FONTS.body} fontWeight={600} fontSize={fontSize} textAnchor="middle"
							style={{paintOrder: 'stroke', stroke: COLORS.bg, strokeWidth: 3}}>{n.label.split('\n').map((l, k) => <tspan key={k} x={c.x} dy={k ? fontSize : 0}>{l}</tspan>)}</text>
					</g>
				);
			})}
		</svg>
	);
};

/** Local: horizontal bars with labels and values, growing with `reveal`; optional log scale.
 * Global: parameter counts, probe accuracy, R². */
export const Bars: React.FC<{w: number; h: number; items: {label: string; value: number; text?: string; color?: string}[]; reveal?: number; log?: [number, number]; max?: number; labelW?: number; barMax?: number}> = ({
	w, h, items, reveal = 1, log, max, labelW = 130, barMax = 26,
}) => {
	const bh = Math.min(barMax, h / items.length); // bar pitch
	const frac = (v: number) => (log ? (Math.log10(v) - log[0]) / (log[1] - log[0]) : v / (max ?? Math.max(...items.map((i) => i.value)))); // 0..1
	return (
		<svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0}}>
			{items.map((it, i) => {
				const grow = smooth(reveal * (items.length + 2) - i); // one after another
				const bw = Math.max(2, (w - labelW - 70) * Math.max(0, frac(it.value)) * grow);
				return (
					<g key={i} transform={`translate(0 ${i * bh})`}>
						<text x={labelW - 6} y={bh * 0.66} fill={COLORS.ink} fontFamily={FONTS.body} fontSize={13} textAnchor="end">{it.label}</text>
						<rect x={labelW} y={bh * 0.18} width={bw} height={bh * 0.64} rx={3} fill={it.color ?? COLORS.cyan} style={{filter: `drop-shadow(0 0 4px ${it.color ?? COLORS.cyan})`}} />
						<text x={labelW + bw + 6} y={bh * 0.66} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={12} opacity={grow}>{it.text ?? String(it.value)}</text>
					</g>
				);
			})}
		</svg>
	);
};

/** Local: monospace math lines typed in over `reveal`. Global: the generic `formula` card. */
export const Formula: React.FC<{text: string; reveal: number; size: number; color: string}> = ({text, reveal, size, color}) => {
	const all = text.split('\n');
	const total = all.reduce((s, l) => s + l.length, 0);
	let left = Math.floor(reveal * total * 1.05); // characters shown so far
	return (
		<div style={{fontFamily: FONTS.mono, fontSize: size, lineHeight: 1.35, color: COLORS.ink, textShadow: glow(color, 0.35)}}>
			{all.map((l, i) => {
				const shown = l.slice(0, Math.max(0, left));
				left -= l.length;
				return <div key={i}>{shown}<span style={{opacity: shown.length < l.length && shown.length > 0 ? 1 : 0, color}}>▍</span></div>;
			})}
		</div>
	);
};

/** Local: compact number like 1.5B, 175B, 1.57T. Global: labels on scale bars. */
export const human = (v: number): string => {
	const units: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
	const u = units.find(([d]) => v >= d);
	return u ? `${+(v / u[0]).toPrecision(3)}${u[1]}` : `${v}`;
};
