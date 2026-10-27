/**
 * Always-on layers: background starfield, audio spectrum ring, beat/cut flashes, HUD, captions.
 * Local: small stateless components, each a pure function of (timeline, time).
 * Global: Anthem.tsx stacks them around the per-section scene, so every scene shares
 * the same audio reactivity and framing.
 * Sources: visualizeAudio/useAudioData https://www.remotion.dev/docs/visualize-audio ,
 *          random() (deterministic) https://www.remotion.dev/docs/random
 */
import React, {useMemo} from 'react'; // JSX + memo
import {AbsoluteFill, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion'; // frame clock + seeded RNG
import {useAudioData, visualizeAudio} from '@remotion/media-utils'; // spectrum of the song at a frame
import {noise2D} from '@remotion/noise'; // deterministic smooth noise for drifting text
import {beatPulse, featureAt, type Section, type Timeline} from '../lib/timeline'; // timing helpers
import {COLORS, FONTS, glow, smooth} from '../lib/theme'; // look

/** Local: drifting stars + violet vignette that breathe with loudness. Global: depth behind every scene. */
export const Background: React.FC<{tl: Timeline; t: number}> = ({tl, t}) => {
	const {width, height, fps} = useVideoConfig(); // frame size
	const stars = useMemo(() => Array.from({length: 220}, (_, i) => ({ // fixed star catalog
		x: random(`sx${i}`) * width, y: random(`sy${i}`) * height, // seeded positions
		r: 0.6 + random(`sr${i}`) * 1.8, tw: random(`st${i}`) * 6.28, // size + twinkle phase
	})), [width, height]);
	const energy = featureAt(tl.energy, fps, t); // loudness 0..1
	return (
		<AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 55%, rgba(139,92,255,${0.10 + 0.18 * energy}) 0%, ${COLORS.bg} 70%)`}}>
			<svg width={width} height={height}>
				{stars.map((s, i) => (
					<circle key={i} cx={(s.x + t * 6 * s.r) % width} cy={s.y} r={s.r} // slow parallax drift
						fill={COLORS.ink} opacity={0.25 + 0.35 * Math.abs(Math.sin(t * 1.3 + s.tw)) * (0.5 + energy)} />
				))}
			</svg>
		</AbsoluteFill>
	);
};

/** Local: circular spectrum bars around the center (mirrored, 2x64 bars). Global: the song is visibly "in" every frame. */
export const SpectrumRing: React.FC<{tl: Timeline; opacity?: number; radius?: number}> = ({tl, opacity = 0.35, radius = 300}) => {
	const frame = useCurrentFrame(); // absolute frame (top-level component)
	const {fps, width, height} = useVideoConfig(); // geometry
	const audioData = useAudioData(staticFile(tl.audio)); // decoded once per render tab
	if (!audioData) return null; // still loading (Remotion waits via delayRender inside the hook)
	const bins = visualizeAudio({fps, frame, audioData, numberOfSamples: 64, optimizeFor: 'speed'}); // 0..1, bass first
	const bars = [...bins, ...[...bins].reverse()]; // mirror for a symmetric ring
	const cx = width / 2; // center x
	const cy = height / 2; // center y
	return (
		<AbsoluteFill style={{opacity}}>
			<svg width={width} height={height}>
				{bars.map((v, i) => {
					const a = (i / bars.length) * Math.PI * 2 - Math.PI / 2; // angle, starting at 12 o'clock
					const len = 8 + 220 * Math.min(1, Math.log10(1 + 9 * v * 3)); // log scaling tames bass dominance
					return (
						<line key={i} x1={cx + Math.cos(a) * radius} y1={cy + Math.sin(a) * radius}
							x2={cx + Math.cos(a) * (radius + len)} y2={cy + Math.sin(a) * (radius + len)}
							stroke={i % 2 ? COLORS.cyan : COLORS.magenta} strokeWidth={6} strokeLinecap="round" />
					);
				})}
			</svg>
		</AbsoluteFill>
	);
};

/** Local: soft flash on downbeats + bright flash at each scene cut. Global: cuts and accents land on the beat. */
export const BeatFlash: React.FC<{tl: Timeline; t: number; section: Section}> = ({tl, t, section}) => {
	const down = 0.07 * beatPulse(tl.downbeats, t, 0.12); // subtle bar-level accent
	const cut = section.index > 0 ? 0.55 * Math.exp(-Math.max(0, t - section.startS) / 0.12) : 0; // scene-change flash
	return <AbsoluteFill style={{background: COLORS.ink, opacity: down + cut, mixBlendMode: 'screen'}} />; // additive
};

/** Local: title, section index/label, time and tempo in the corners. Global: "scientific instrument" framing. */
export const Hud: React.FC<{tl: Timeline; t: number; section: Section; caption: string}> = ({tl, t, section, caption}) => {
	const mm = Math.floor(t / 60).toString().padStart(2, '0'); // minutes
	const ss = (t % 60).toFixed(1).padStart(4, '0'); // seconds with one decimal
	const pos = tl.sections.findIndex((s) => s.index === section.index) + 1; // 1-based scene number
	const style: React.CSSProperties = {position: 'absolute', top: 36, fontFamily: FONTS.mono, fontSize: 20, color: COLORS.dim, letterSpacing: '0.12em'};
	return (
		<AbsoluteFill>
			<div style={{...style, left: 48}}>
				<span style={{fontFamily: FONTS.display, color: COLORS.ink, fontWeight: 700}}>{tl.title.toUpperCase()}</span>
				{`  ·  §${String(pos).padStart(2, '0')}/${tl.sections.length}  ${section.label.toUpperCase()}  —  ${caption}`}
			</div>
			<div style={{...style, right: 48}}>{`t=${mm}:${ss}  ·  ${tl.tempoBpm.toFixed(0)} BPM`}</div>
		</AbsoluteFill>
	);
};

/** Local: the current section's card citations scrolling right to left along the bottom edge (~110 px/s).
 * Global: every reference behind what is on screen, in order; content from timeline.json "vignettes". */
export const Ticker: React.FC<{tl: Timeline; t: number; section: Section}> = ({tl, t, section}) => {
	const cites = [...new Set(tl.vignettes.filter((v) => v.sectionIndex === section.index).map((v) => v.cite))]; // unique, in card order
	if (!cites.length) return null;
	const text = cites.join('   ◆   ') + '   ◆   '; // one loop
	const loop = text.length * 9; // JetBrains Mono advance is 0.6 em -> 9 px per character at 15 px
	const x = -(((t - section.startS) * 110) % loop); // scroll offset
	return (
		<div style={{position: 'absolute', left: 0, right: 0, bottom: 4, height: 22, overflow: 'hidden', opacity: 0.75}}>
			<div style={{position: 'absolute', left: x, whiteSpace: 'nowrap', fontFamily: FONTS.mono, fontSize: 15, color: COLORS.dim}}>{text}{text}{text}</div>
		</div>
	);
};

/** Local: the section's card titles and formulas drifting faintly behind the scene (seeded Perlin-style noise).
 * Global: dense background texture made only of the ideas this section illustrates. Source: https://www.remotion.dev/docs/noise/noise-2d */
export const EquationDust: React.FC<{tl: Timeline; t: number; section: Section}> = ({tl, t, section}) => {
	const {width, height} = useVideoConfig(); // frame size
	const items = tl.vignettes.filter((v) => v.sectionIndex === section.index).map((v) => (v.id === 'formula' ? v.text.split('\n')[0] : v.title)); // this section's ideas
	return (
		<AbsoluteFill>
			{items.map((txt, i) => {
				const x = (random(`dx${section.index}-${i}`) * 0.9 + 0.05) * width + 120 * noise2D(`nx${i}`, t * 0.05, i); // drifting position
				const y = (random(`dy${section.index}-${i}`) * 0.62 + 0.14) * height + 60 * noise2D(`ny${i}`, i, t * 0.05); // stays above the lyric band
				return (
					<div key={i} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${(random(`dr${i}`) - 0.5) * 16}deg)`,
						fontFamily: FONTS.mono, fontSize: 20 + 22 * random(`ds${i}`), color: COLORS.ink, opacity: 0.035 + 0.02 * (noise2D(`no${i}`, t * 0.3, 0) + 1), whiteSpace: 'nowrap'}}>{txt}</div>
				);
			})}
		</AbsoluteFill>
	);
};

/** Local: a labelled panel that fades in at `at` seconds (scene-local). Global: concept labels/sources inside scenes. */
export const Caption: React.FC<{local: number; at: number; x: number; y: number; title: React.ReactNode; sub?: string; color?: string; size?: number; align?: 'left' | 'right' | 'center'}> = ({
	local, at, x, y, title, sub, color = COLORS.cyan, size = 34, align = 'left',
}) => {
	const a = smooth((local - at) / 0.5); // 0.5 s fade
	return (
		<div style={{position: 'absolute', left: x, top: y, opacity: a, transform: `translateY(${(1 - a) * 14}px)`, textAlign: align, maxWidth: 760}}>
			<div style={{fontFamily: FONTS.display, fontWeight: 700, fontSize: size, color: COLORS.ink, textShadow: glow(color, 0.5), letterSpacing: '0.05em'}}>{title}</div>
			{sub ? <div style={{fontFamily: FONTS.body, fontSize: size * 0.6, color: COLORS.dim, marginTop: 8}}>{sub}</div> : null}
		</div>
	);
};
