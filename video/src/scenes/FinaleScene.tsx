/**
 * Final chorus (key change) — ideal solving.
 * Local: gold palette; a slowly turning gold halo that pulses on beats behind the giant sung words. The concrete
 * content (the shortest program, the do()-intervention graph, AIXI, ActAdd steering, an ARC-style puzzle) is
 * drawn by the illustration track's cards above and below the words (content/vignettes.toml, "final chorus").
 * Global: the song's definition of "fully understanding": the most compressed theory that predicts any behavior
 * and any intervention.
 */
import React from 'react'; // JSX
import {AbsoluteFill} from 'remotion'; // layer
import {beatPulse} from '../lib/timeline'; // beat kick
import {COLORS, smooth, useSceneClock} from '../lib/theme'; // look + clock
import {BigWords} from '../components/BigWords'; // kinetic lyrics
import type {SceneProps} from './types'; // contract

export const FinaleScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t, local} = useSceneClock(section); // time
	const pulse = beatPulse(tl.downbeats, t, 0.25); // bar-level kick
	return (
		<AbsoluteFill>
			<svg width={1920} height={1080} style={{position: 'absolute', opacity: smooth(local / 0.8)}}>
				{Array.from({length: 48}, (_, i) => { // gold rays around the words
					const a = (i / 48) * Math.PI * 2 + local * 0.08, r0 = 260 + 30 * pulse, r1 = 420 + 60 * pulse + (i % 3) * 30;
					return <line key={i} x1={960 + Math.cos(a) * r0} y1={540 + Math.sin(a) * r0 * 0.62} x2={960 + Math.cos(a) * r1} y2={540 + Math.sin(a) * r1 * 0.62}
						stroke={COLORS.amber} strokeWidth={3} opacity={0.18 + 0.2 * pulse} />;
				})}
			</svg>
			<BigWords tl={tl} t={t} color={COLORS.amber} y={10} />
		</AbsoluteFill>
	);
};
