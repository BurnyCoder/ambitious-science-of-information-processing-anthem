/**
 * The music video composition.
 * Local: stacks background -> spectrum ring -> the world (equation dust, the scene of the moment, its figure panels and
 * the lyrics; World.tsx) -> beat/cut flashes -> HUD -> citation ticker, and plays the song. During the outro the world
 * is replaced by the rewind: frozen copies of earlier moments (stage/rewind.ts), each new cut flying in while the
 * previous frame zooms past the camera, under the live outro lyrics and the outro's figures as headline plates. Where
 * the rewind lands, the overview (stage/OverviewLayer.tsx) bursts out of the token under the live World (the statement).
 * Global: rendered by `remotion render ... Anthem`; everything is derived from the
 * timeline prop that Root.tsx's calculateMetadata loads from public/timeline.json.
 * Sources: https://www.remotion.dev/docs/freeze , https://www.remotion.dev/docs/media/audio
 */
import React from 'react'; // JSX
import {AbsoluteFill, Freeze, staticFile, useCurrentFrame, useVideoConfig} from 'remotion'; // frame clock + freeze
import {Audio} from '@remotion/media'; // frame-accurate audio (extracted with Mediabunny when rendering)
import type {Timeline} from './lib/timeline'; // data
import {COLORS, FONTS, glow} from './lib/theme'; // palette
import {Background, BeatFlash, Hud, SpectrumRing, Ticker} from './components/Overlays'; // shared layers
import {KineticLyrics} from './components/KineticLyrics'; // karaoke (live, over the rewind)
import {World, sectionAt} from './World'; // the video at a frame
import {rewindAt, rewindPlan, type Copy} from './stage/rewind'; // the outro's rewind schedule
import {cardsOn} from './stage/shots'; // the outro's figures (headline plates)
import {Overview} from './stage/OverviewLayer'; // everything at once, after the rewind
import {sceneLayout} from './stage/layout'; // lyric band per scene
import {SCENES} from './scenes'; // HUD captions

export type AnthemProps = {timelineFile: string; timeline: Timeline | null; debugLayout?: boolean}; // composition props (debugLayout: stills.mjs --layout)

/** Local: one frozen copy of the video at its source moment, flying (scale), fading, blurred and RGB-split.
 * Global: the rewind's zoom-through transitions. */
const RewindCopy: React.FC<{tl: Timeline; c: Copy; fps: number}> = ({tl, c, fps}) => (
	<AbsoluteFill style={{transform: `scale(${c.scale})`, opacity: c.opacity,
		filter: [c.blur > 0.05 ? `blur(${c.blur}px)` : '', c.split > 0.02 ? `drop-shadow(${14 * c.split}px 0 0 rgba(255,63,209,0.8)) drop-shadow(${-14 * c.split}px 0 0 rgba(34,228,255,0.8))` : ''].join(' ') || undefined}}>
		<Freeze frame={Math.max(0, Math.round(c.src * fps))}>
			<World tl={tl} lyrics={false} />
		</Freeze>
	</AbsoluteFill>
);

export const Anthem: React.FC<AnthemProps> = ({timeline, debugLayout}) => {
	const frame = useCurrentFrame(); // absolute frame
	const {fps} = useVideoConfig(); // fps from calculateMetadata
	if (!timeline) return <AbsoluteFill style={{background: COLORS.bg}} />; // calculateMetadata not resolved yet
	const tl = timeline; // shorthand
	const t = frame / fps; // absolute seconds
	const section = sectionAt(tl, t); // the live section (the song's)
	const plan = rewindPlan(tl); // the outro's rewind (a few hundred numbers; recomputed per frame, deterministic)
	const copies = plan ? rewindAt(plan, t) : []; // frozen copies on screen now
	const shown = copies.length ? sectionAt(tl, copies[0].src) : section; // what the HUD reports: the moment being rewound
	const plates = copies.length ? cardsOn(tl.vignettes, section.index, t).slice(-1) : []; // the outro's newest figure, as a headline plate
	return (
		<AbsoluteFill style={{background: COLORS.bg}}>
			<Background tl={tl} t={t} />
			<SpectrumRing tl={tl} opacity={sceneLayout(section.scene).band === 'bigLyrics' ? 0.45 : 0.22} />
			{plan && t >= plan.end ? <Overview tl={tl} start={plan.end} /> : null}
			{copies.length ? copies.map((c) => <RewindCopy key={c.key} tl={tl} c={c} fps={fps} />) : <World tl={tl} debugLayout={debugLayout} />}
			{plates.map(({v, on}) => ( // "The mathematics of AI / of intelligence / of information itself / We must now"
				<div key={v.startS} style={{position: 'absolute', top: 96, width: '100%', textAlign: 'center', opacity: on, transform: `scale(${0.9 + 0.1 * on})`}}>
					<span style={{display: 'inline-block', padding: '10px 26px', borderRadius: 14, background: 'rgba(6,8,22,0.82)', border: `2px solid ${COLORS.cyan}`}}>
						<div style={{fontFamily: FONTS.display, fontWeight: 900, fontSize: 44, color: COLORS.ink, textShadow: glow(COLORS.cyan, 0.8)}}>{v.title}</div>
						<div style={{fontFamily: FONTS.mono, fontSize: 24, color: COLORS.amber}}>{v.text.split('\n')[0]}</div>
						<div style={{fontFamily: FONTS.mono, fontSize: 13, color: COLORS.dim}}>{v.cite}</div>
					</span>
				</div>
			))}
			{copies.length ? <KineticLyrics tl={tl} t={t} /> : null}
			<BeatFlash tl={tl} t={t} section={section} />
			<Hud tl={tl} t={copies.length ? copies[0].src : t} section={shown}
				caption={copies.length ? `◀◀ REWIND · ${(SCENES[shown.scene] ?? SCENES.default).caption}` : (SCENES[section.scene] ?? SCENES.default).caption} />
			<Ticker tl={tl} t={t} section={section} />
			<Audio src={staticFile(tl.audio)} />
		</AbsoluteFill>
	);
};
