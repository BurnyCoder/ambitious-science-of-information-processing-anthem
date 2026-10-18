/**
 * Composition list.
 * Local: declares the 1920x1080 "Anthem" composition; calculateMetadata fetches
 * public/timeline.json and sets fps, duration and the timeline prop from it.
 * Global: the Python pipeline only has to write timeline.json + anthem.mp3; the
 * video length always matches the song. Sources: https://www.remotion.dev/docs/calculate-metadata ,
 * https://www.remotion.dev/docs/data-fetching , https://www.remotion.dev/docs/staticfile
 */
import React from 'react'; // JSX
import {Composition, staticFile, type CalculateMetadataFunction} from 'remotion'; // composition API
import {Anthem, type AnthemProps} from './Anthem'; // the video
import type {Timeline} from './lib/timeline'; // data contract

const calculateMetadata: CalculateMetadataFunction<AnthemProps> = async ({props, abortSignal}) => {
	const res = await fetch(staticFile(props.timelineFile), {signal: abortSignal}); // served from public/
	if (!res.ok) throw new Error(`Missing ${props.timelineFile}: run \`uv run anthem --stage timeline\` first`); // actionable error
	const timeline = (await res.json()) as Timeline; // parsed contract
	return {fps: timeline.fps, durationInFrames: timeline.durationInFrames, props: {...props, timeline}}; // song-length video
};

export const RemotionRoot: React.FC = () => (
	<Composition
		id="Anthem"
		component={Anthem}
		width={1920}
		height={1080}
		fps={30}
		durationInFrames={300}
		defaultProps={{timelineFile: 'timeline.json', timeline: null} satisfies AnthemProps}
		calculateMetadata={calculateMetadata}
	/>
);
