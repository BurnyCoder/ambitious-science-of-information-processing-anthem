/**
 * The music video composition.
 * Local: stacks background -> equation dust -> spectrum ring -> one <Sequence> per song section (its scene; zoom-punched
 * on downbeats, RGB-split for 0.25 s after each cut) -> stage (figure cards diving out of the scene objects; the camera pushes toward
 * the hero's object) -> giant words (chorus-type scenes, lower third) or karaoke overlay -> beat/cut flashes -> HUD, and plays the song.
 * Global: rendered by `remotion render ... Anthem`; everything is derived from the
 * timeline prop that Root.tsx's calculateMetadata loads from public/timeline.json.
 * Sources: https://www.remotion.dev/docs/sequence , https://www.remotion.dev/docs/media/audio
 */
import React from 'react'; // JSX
import {AbsoluteFill, Sequence, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion'; // timeline primitives + seeded jitter
import {Audio} from '@remotion/media'; // frame-accurate audio (extracted with Mediabunny when rendering)
import {beatPulse, lastIndexAtOrBefore, toFrame, type Timeline} from './lib/timeline'; // data + helpers
import {COLORS} from './lib/theme'; // palette
import {Background, BeatFlash, EquationDust, Hud, SpectrumRing, Ticker} from './components/Overlays'; // shared layers
import {KineticLyrics} from './components/KineticLyrics'; // karaoke
import {BigWords} from './components/BigWords'; // giant sung words (chorus-type scenes)
import {StageLayer} from './stage/StageLayer'; // figure cards as dive-in hero shots
import {focusOf, heroness, shotsAt} from './stage/shots'; // shot lifecycle + camera focus
import {anchorOf} from './stage/anchors'; // where the hero comes from
import {SCENES} from './scenes'; // scene registry

export type AnthemProps = {timelineFile: string; timeline: Timeline | null}; // composition props

export const Anthem: React.FC<AnthemProps> = ({timeline}) => {
	const frame = useCurrentFrame(); // absolute frame
	const {fps} = useVideoConfig(); // fps from calculateMetadata
	if (!timeline) return <AbsoluteFill style={{background: COLORS.bg}} />; // calculateMetadata not resolved yet
	const tl = timeline; // shorthand
	const t = frame / fps; // absolute seconds
	const si = Math.max(0, lastIndexAtOrBefore(tl.sections.map((s) => s.startS), t)); // current section
	const section = tl.sections[si]; // its record
	const entry = SCENES[section.scene] ?? SCENES.default; // its scene
	const punch = 1 + (entry.bigLyrics ? 0.03 : 0.012) * beatPulse(tl.downbeats, t, 0.15); // zoom kick on each bar
	const glitch = section.index > 0 ? Math.max(0, 1 - (t - section.startS) / 0.25) : 0; // 1 -> 0 over 0.25 s after a cut
	const jitter = glitch ? (random(`glitch${frame}`) - 0.5) * 36 * glitch : 0; // seeded horizontal shake
	const shots = shotsAt(tl.vignettes, tl.sections, t); // every card on stage now
	const staged = shots.map((s) => ({shot: s, anchor: anchorOf(tl, tl.sections.find((x) => x.index === s.v.sectionIndex) ?? section, s.v, s.k, t)})); // once per frame
	const weights = shots.map(heroness); // how much each card is the hero
	const push = Math.max(0, ...weights); // 0..1: how far the camera is pushed into the hero's object
	const focus = focusOf(staged.flatMap(({anchor}, i) => (weights[i] > 0 ? [{...anchor, w: weights[i]}] : []))); // camera aims at the heroes' objects
	const pulse = beatPulse(tl.beats, t); // beat kick for the cards
	const lead = section.scene === 'finale' ? COLORS.amber : section.occurrence % 2 === 1 ? COLORS.cyan : COLORS.magenta; // giant-word colour
	return (
		<AbsoluteFill style={{background: COLORS.bg}}>
			<Background tl={tl} t={t} />
			<EquationDust tl={tl} t={t} section={section} />
			<SpectrumRing tl={tl} opacity={entry.bigLyrics ? 0.45 : 0.22} />
			<AbsoluteFill style={{transform: `translateX(${jitter}px) scale(${punch * (1 + 0.08 * push)})`, transformOrigin: `${focus.x}px ${focus.y}px`,
				filter: `brightness(${1 - 0.28 * push})` + (glitch ? ` drop-shadow(${10 * glitch}px 0 0 rgba(255,63,209,0.85)) drop-shadow(${-10 * glitch}px 0 0 rgba(34,228,255,0.85))` : '')}}>
			{tl.sections.map((s) => {
				const from = toFrame(s.startS, fps); // first frame of this section
				const Scene = (SCENES[s.scene] ?? SCENES.default).component; // its component
				return (
					<Sequence key={s.index} from={from} durationInFrames={Math.max(1, toFrame(s.endS, fps) - from)} name={`${s.label} · ${s.scene}`} premountFor={fps}>
						<Scene tl={tl} section={s} />
					</Sequence>
				);
			})}
			</AbsoluteFill>
			<StageLayer tl={tl} staged={staged} t={t} big={Boolean(entry.bigLyrics)} pulse={pulse} />
			{entry.bigLyrics ? <BigWords tl={tl} t={t} color={lead} y={262} maxSize={150} /> : <KineticLyrics tl={tl} t={t} />}
			<BeatFlash tl={tl} t={t} section={section} />
			<Hud tl={tl} t={t} section={section} caption={entry.caption} />
			<Ticker tl={tl} t={t} section={section} />
			<Audio src={staticFile(tl.audio)} />
		</AbsoluteFill>
	);
};
