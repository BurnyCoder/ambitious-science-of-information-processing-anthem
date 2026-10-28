/**
 * The world of the video at the current frame: equation dust, the scene of the moment (one <Sequence> per section,
 * zoom-punched on downbeats and RGB-split after each cut), the figure panels in that scene's slots, and the lyrics.
 * Local: everything is computed from useCurrentFrame(), so the same component draws the live video and, inside
 * Remotion's <Freeze frame>, any earlier moment of it (the outro's rewind).
 * Global: Anthem.tsx draws it live, or frozen copies of it during the rewind (stage/rewind.ts).
 * Sources: https://www.remotion.dev/docs/sequence , https://www.remotion.dev/docs/freeze
 */
import React from 'react'; // JSX
import {AbsoluteFill, Sequence, random, useCurrentFrame, useVideoConfig} from 'remotion'; // timeline primitives + seeded jitter
import {beatPulse, lastIndexAtOrBefore, toFrame, type Timeline} from './lib/timeline'; // data + helpers
import {COLORS} from './lib/theme'; // palette
import {EquationDust} from './components/Overlays'; // drifting card titles
import {KineticLyrics} from './components/KineticLyrics'; // karaoke
import {BigWords} from './components/BigWords'; // giant sung words (chorus-type scenes)
import {StageLayer} from './stage/StageLayer'; // figure panels in their scene's slots
import {shotsAt} from './stage/shots'; // card lifecycle
import {anchorOf} from './stage/anchors'; // the object each figure comes from
import {sceneLayout} from './stage/layout'; // slots, accent and lyric band per scene
import {SCENES} from './scenes'; // scene registry

/** Local: section index at time t. Global: World and Anthem's HUD. */
export const sectionAt = (tl: Timeline, t: number) => tl.sections[Math.max(0, lastIndexAtOrBefore(tl.sections.map((s) => s.startS), t))];

export const World: React.FC<{tl: Timeline; lyrics?: boolean; debugLayout?: boolean}> = ({tl, lyrics = true, debugLayout}) => {
	const frame = useCurrentFrame(); // the live frame, or the frozen one inside <Freeze>
	const {fps} = useVideoConfig(); // fps from calculateMetadata
	const t = frame / fps; // seconds
	const section = sectionAt(tl, t); // the scene of the moment
	const big = sceneLayout(section.scene).band === 'bigLyrics'; // giant words in the lower third instead of karaoke
	const punch = 1 + (big ? 0.03 : 0.012) * beatPulse(tl.downbeats, t, 0.15); // zoom kick on each bar
	const glitch = section.index > 0 ? Math.max(0, 1 - (t - section.startS) / 0.25) : 0; // 1 -> 0 over 0.25 s after a cut
	const jitter = glitch ? (random(`glitch${frame}`) - 0.5) * 36 * glitch : 0; // seeded horizontal shake
	const staged = shotsAt(tl.vignettes, tl.sections, t).map((s) => { // each panel with its object, its slot and its scene's colour
		const sec = tl.sections.find((x) => x.index === s.v.sectionIndex) ?? section;
		const lay = sceneLayout(sec.scene);
		return {shot: s, anchor: anchorOf(tl, sec, s.v, s.k, t), rect: lay.slots[s.slot] ?? lay.slots[0], accent: lay.accent};
	}).filter((st) => st.rect); // a lane without a slot in its scene is not drawn (tests/test_layout.py forbids it)
	const pulse = beatPulse(tl.beats, t); // beat kick for the panels
	const lead = section.scene === 'finale' ? COLORS.amber : section.occurrence % 2 === 1 ? COLORS.cyan : COLORS.magenta; // giant-word colour
	return (
		<AbsoluteFill>
			<EquationDust tl={tl} t={t} section={section} />
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
			{lyrics ? (big ? <BigWords tl={tl} t={t} color={lead} y={262} maxSize={150} /> : <KineticLyrics tl={tl} t={t} />) : null}
		</AbsoluteFill>
	);
};
