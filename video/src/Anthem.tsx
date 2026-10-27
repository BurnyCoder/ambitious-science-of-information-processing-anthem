/**
 * The music video composition.
 * Local: stacks background -> spectrum ring -> one <Sequence> per song section (its scene) ->
 * figure cards -> karaoke overlay -> beat/cut flashes -> HUD, and plays the song.
 * Global: rendered by `remotion render ... Anthem`; everything is derived from the
 * timeline prop that Root.tsx's calculateMetadata loads from public/timeline.json.
 * Sources: https://www.remotion.dev/docs/sequence , https://www.remotion.dev/docs/media/audio
 */
import React from 'react'; // JSX
import {AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion'; // timeline primitives
import {Audio} from '@remotion/media'; // frame-accurate audio (extracted with Mediabunny when rendering)
import {lastIndexAtOrBefore, toFrame, type Timeline} from './lib/timeline'; // data + helpers
import {COLORS} from './lib/theme'; // palette
import {Background, BeatFlash, Hud, SpectrumRing} from './components/Overlays'; // shared layers
import {KineticLyrics} from './components/KineticLyrics'; // karaoke
import {VignetteLayer} from './components/VignetteLayer'; // figure cards
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
	return (
		<AbsoluteFill style={{background: COLORS.bg}}>
			<Background tl={tl} t={t} />
			<SpectrumRing tl={tl} opacity={entry.bigLyrics ? 0.45 : 0.22} />
			{tl.sections.map((s) => {
				const from = toFrame(s.startS, fps); // first frame of this section
				const Scene = (SCENES[s.scene] ?? SCENES.default).component; // its component
				return (
					<Sequence key={s.index} from={from} durationInFrames={Math.max(1, toFrame(s.endS, fps) - from)} name={`${s.label} · ${s.scene}`} premountFor={fps}>
						<Scene tl={tl} section={s} />
					</Sequence>
				);
			})}
			<VignetteLayer tl={tl} t={t} />
			{entry.bigLyrics ? null : <KineticLyrics tl={tl} t={t} />}
			<BeatFlash tl={tl} t={t} section={section} />
			<Hud tl={tl} t={t} section={section} caption={entry.caption} />
			<Audio src={staticFile(tl.audio)} />
		</AbsoluteFill>
	);
};
