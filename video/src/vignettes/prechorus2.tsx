/**
 * Pre-chorus 2 cards: "They said it would be noise ... structure everywhere, function vectors, shapes of thought,
 * geometry that mirrors the world, and the bigger they get, the crisper the concepts".
 * Local: superposition (the intro figure saved in Anthropic's TMS notebook, panel by panel), polysemantic
 * (schematic), bsf (Goodfire's Figure 1, MIT), functionVector (real antonym pairs from Todd et al.'s dataset),
 * truth (schematic two-cluster split), worldMap (real coordinates from Gurnee & Tegmark's dataset), probeR2
 * (their Table 2).
 * Global: registered in ./index.ts. Images are served from public/vignettes/ via staticFile().
 * Sources: https://www.remotion.dev/docs/img , https://www.remotion.dev/docs/staticfile
 */
import React from 'react'; // JSX
import {Img, random, staticFile} from 'remotion'; // images that block rendering until loaded + seeded jitter
import {COLORS, FONTS, smooth} from '../lib/theme'; // look
import {Bars, type BodyProps} from './primitives'; // building blocks
import antonyms from '../../public/vignettes/antonyms.json'; // Todd et al. antonym pairs
import world from '../../public/vignettes/world.json'; // Gurnee & Tegmark places + R²

/** The 10 sparsity levels of the TMS intro figure, revealed left to right (dense -> sparse). */
export const Superposition: React.FC<BodyProps> = ({local, w, h}) => {
	const shown = Math.min(10, 1 + Math.floor(local * 3.5)); // panels visible
	const imgW = w, imgH = (w * 302) / 3140; // native aspect of the saved figure (10 panels)
	const zoom = (h - 22) / imgH; // fill the card height so the last panels are readable
	return (
		<div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: imgW * zoom, height: imgH * zoom, transform: `translateX(${-Math.max(0, (shown / 10) * imgW * zoom - w)}px)`}}>
				<Img src={staticFile('vignettes/tms_intro.png')} style={{width: imgW * zoom, height: imgH * zoom, filter: 'invert(0.92) hue-rotate(180deg)'}} />
				<div style={{position: 'absolute', left: (shown / 10) * imgW * zoom, top: 0, right: 0, bottom: 0, background: COLORS.bg}} />
			</div>
			<div style={{position: 'absolute', bottom: 0, fontFamily: FONTS.mono, fontSize: 12, color: COLORS.dim}}>feature density 1 → 1/20 (left → right); color = importance</div>
		</div>
	);
};

/** One neuron responds to unrelated things; a sparse dictionary splits it into features. */
export const Polysemantic: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const meanings = ['academic citations', 'English dialogue', 'HTTP requests', 'Korean text']; // Anthropic 2023's example of one small-model neuron
	const split = smooth((local - 1) / 1.2);
	const cy = h / 2;
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			<circle cx={w * 0.14} cy={cy} r={22} fill={COLORS.magenta} />
			<text x={w * 0.14} y={cy + 44} fill={COLORS.ink} fontFamily={FONTS.mono} fontSize={12} textAnchor="middle">one neuron</text>
			{meanings.map((m, i) => { const y = ((i + 0.5) / meanings.length) * h;
				return <g key={m}>
					<line x1={w * 0.14 + 22} y1={cy} x2={w * 0.5} y2={y} stroke={COLORS.dim} opacity={1 - split * 0.6} />
					<circle cx={w * 0.5} cy={y} r={9} fill={accent} opacity={split} />
					<text x={w * 0.5 + 16} y={y + 5} fill={COLORS.ink} fontFamily={FONTS.body} fontSize={14}>{m}</text>
				</g>; })}
		</svg>
	);
};

/** Goodfire's Figure 1: concepts recovered as regions with an internal coordinate (hue) vs one SAE direction. */
export const Bsf: React.FC<BodyProps> = ({local, w, h}) => {
	const ih = Math.min(h, (w * 458) / 1200); // keep the figure's aspect
	return (
		<div style={{position: 'absolute', inset: 0, overflow: 'hidden', opacity: smooth(local / 0.6)}}>
			<Img src={staticFile('vignettes/bsf_figure1.jpg')} style={{width: (ih * 1200) / 458, height: ih, transform: `scale(${1 + 0.04 * local})`, transformOrigin: 'left center'}} />
		</div>
	);
};

/** Real antonym pairs from the task the function vector encodes, typed in. */
export const FunctionVector: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const rows = Math.max(3, Math.floor(h / 24)); // pairs that fit
	return (
		<div style={{position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, fontFamily: FONTS.mono, fontSize: 15, color: COLORS.ink, width: w}}>
			{antonyms.slice(0, rows * 2).map((p, i) => (
				<div key={i} style={{opacity: smooth(local * 4 - i * 0.4)}}>{p.input} <span style={{color: accent}}>+ v →</span> {p.output}</div>
			))}
		</div>
	);
};

/** True and false statements on either side of one direction (schematic of the paper's PCA plots). */
export const Truth: React.FC<BodyProps> = ({local, w, h}) => {
	const pts = Array.from({length: 80}, (_, i) => ({t: i % 2 === 0, x: random(`tx${i}`), y: random(`ty${i}`)}));
	const sep = smooth((local - 0.6) / 1.2); // clusters pull apart
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			{pts.map((p, i) => <circle key={i} cx={w * (0.5 + (p.t ? 1 : -1) * (0.05 + 0.22 * sep) + (p.x - 0.5) * 0.35)} cy={h * (0.15 + 0.7 * p.y)} r={4} fill={p.t ? COLORS.lime : COLORS.magenta} opacity={0.8} />)}
			<line x1={w / 2} y1={6} x2={w / 2} y2={h - 6} stroke={COLORS.ink} strokeDasharray="5 5" opacity={sep} />
			<text x={w * 0.82} y={16} fill={COLORS.lime} fontFamily={FONTS.mono} fontSize={13}>true</text>
			<text x={w * 0.06} y={16} fill={COLORS.magenta} fontFamily={FONTS.mono} fontSize={13}>false</text>
		</svg>
	);
};

/** The 900 most-viewed places of the dataset, drawn at their real longitude and latitude. */
export const WorldMap: React.FC<BodyProps> = ({local, w, h, accent}) => {
	const sx = (lon: number) => ((lon + 180) / 360) * w, sy = (lat: number) => ((80 - lat) / 140) * h; // equirectangular, 80°N..60°S
	return (
		<svg width={w} height={h} style={{position: 'absolute'}}>
			{world.places.map(([lon, lat], i) => <circle key={i} cx={sx(lon)} cy={sy(lat)} r={1.7} fill={accent} opacity={smooth(local * 2 - (i / world.places.length) * 1.5) * 0.85} />)}
		</svg>
	);
};

/** Out-of-sample R² of the world-place probe by Llama-2 size (Gurnee & Tegmark, Table 2). */
export const ProbeR2: React.FC<BodyProps> = ({local, w, h, accent}) => (
	<Bars w={w} h={h} labelW={110} max={1} barMax={46} reveal={smooth(local / 1.5)}
		items={Object.entries(world.r2).map(([m, v]) => ({label: m, value: v, text: v.toFixed(3), color: accent}))} />
);
