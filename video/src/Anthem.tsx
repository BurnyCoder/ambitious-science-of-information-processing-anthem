/**
 * The music video composition.
 * Local: stacks background -> equation dust -> spectrum ring -> one <Sequence> per song section (its scene; zoom-punched
 * on downbeats, RGB-split for 0.25 s after each cut) -> stage (figure panels in the scene's own slots, wired to the objects they
 * explain; the scene is never dimmed for them) -> giant words (lower third) or karaoke -> beat/cut flashes -> HUD, and plays the song.
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
import {shotsAt} from './stage/shots'; // card lifecycle
import {anchorOf} from './stage/anchors'; // the object each figure comes from
import {sceneLayout} from './stage/layout'; // slots, accent and lyric band per scene
import {SCENES} from './scenes'; // scene registry

export type AnthemProps = {timelineFile: string; timeline: Timeline | null; debugLayout?: boolean}; // composition props (debugLayout: stills.mjs --layout)

export const Anthem: React.FC<AnthemProps> = ({timeline, debugLayout}) => {
	const frame = useCurrentFrame(); // absolute frame
	const {fps} = useVideoConfig(); // fps from calculateMetadata
	if (!timeline) return <AbsoluteFill style={{background: COLORS.bg}} />; // calculateMetadata not resolved yet
	const tl = timeline; // shorthand
	const t = frame / fps; // absolute seconds
	const si = Math.max(0, lastIndexAtOrBefore(tl.sections.map((s) => s.startS), t)); // current section
	const section = tl.sections[si]; // its record
	const entry = SCENES[section.scene] ?? SCENES.default; // its scene
	const big = sceneLayout(section.scene).band === 'bigLyrics'; // giant words in the lower third instead of karaoke
	const punch = 1 + (big ? 0.03 : 0.012) * beatPulse(tl.downbeats, t, 0.15); // zoom kick on each bar
	const glitch = section.index > 0 ? Math.max(0, 1 - (t - section.startS) / 0.25) : 0; // 1 -> 0 over 0.25 s after a cut
	const jitter = glitch ? (random(`glitch${frame}`) - 0.5) * 36 * glitch : 0; // seeded horizontal shake
	const shots = shotsAt(tl.vignettes, tl.sections, t); // every card on stage now
	const staged = shots.map((s) => { // each panel with its object, its slot and its scene's colour (once per frame)
		const sec = tl.sections.find((x) => x.index === s.v.sectionIndex) ?? section;
		const lay = sceneLayout(sec.scene);
		return {shot: s, anchor: anchorOf(tl, sec, s.v, s.k, t), rect: lay.slots[s.slot] ?? lay.slots[0], accent: lay.accent};
	}).filter((st) => st.rect); // a lane without a slot in its scene is not drawn (tests/test_layout.py forbids it)
	const pulse = beatPulse(tl.beats, t); // beat kick for the cards
	const lead = section.scene === 'finale' ? COLORS.amber : section.occurrence % 2 === 1 ? COLORS.cyan : COLORS.magenta; // giant-word colour
	return (
		<AbsoluteFill style={{background: COLORS.bg}}>
			<Background tl={tl} t={t} />
			<EquationDust tl={tl} t={t} section={section} />
			<SpectrumRing tl={tl} opacity={big ? 0.45 : 0.22} />
			<AbsoluteFill style={{transform: `translateX(${jitter}px) scale(${punch})`,
				filter: glitch ? `drop-shadow(${10 * glitch}px 0 0 rgba(255,63,209,0.85)) drop-shadow(${-10 * glitch}px 0 0 rgba(34,228,255,0.85))` : undefined}}>
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
			<StageLayer tl={tl} staged={staged} t={t} pulse={pulse} scene={section.scene} debug={debugLayout} />
			{big ? <BigWords tl={tl} t={t} color={lead} y={262} maxSize={150} /> : <KineticLyrics tl={tl} t={t} />}
			<BeatFlash tl={tl} t={t} section={section} />
			<Hud tl={tl} t={t} section={section} caption={entry.caption} />
			<Ticker tl={tl} t={t} section={section} />
			<Audio src={staticFile(tl.audio)} />
		</AbsoluteFill>
	);
};
