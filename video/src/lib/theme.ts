/**
 * Visual identity: palette, fonts, and the per-scene time hook.
 * Local: neon-on-near-black color tokens, three Google fonts loaded through Remotion
 * (so rendering waits for them), and useSceneClock() giving absolute + local time.
 * Global: every scene/overlay imports these, so the look and the timing math stay in one place.
 * Sources: https://www.remotion.dev/docs/google-fonts/load-font ,
 *          https://www.remotion.dev/docs/use-current-frame , https://www.remotion.dev/docs/use-video-config
 */
import {loadFont as loadOrbitron} from '@remotion/google-fonts/Orbitron'; // display face for titles/kinetic words
import {loadFont as loadGrotesk} from '@remotion/google-fonts/SpaceGrotesk'; // body face for lyrics/labels
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono'; // math/equations
import {useCurrentFrame, useVideoConfig} from 'remotion'; // frame clock
import type {Section} from './timeline'; // section bounds

export const COLORS = {
	bg: '#04050d', // near-black with a blue tint
	ink: '#e8f1ff', // primary text
	dim: 'rgba(232,241,255,0.38)', // upcoming words / secondary text
	cyan: '#22e4ff', // main neon
	magenta: '#ff3fd1', // accent neon
	violet: '#8b5cff', // depth/background glows
	amber: '#ffc247', // key-change / finale gold
	lime: '#9dff5c', // "understood" / success
} as const;

export const FONTS = {
	display: loadOrbitron('normal', {weights: ['700', '900'], subsets: ['latin']}).fontFamily, // bold futurist
	body: loadGrotesk('normal', {weights: ['400', '600'], subsets: ['latin']}).fontFamily, // readable sans
	mono: loadMono('normal', {weights: ['400', '700'], subsets: ['latin']}).fontFamily, // equations
} as const;

/** Local: CSS text-shadow that looks like neon glow. Global: consistent glow everywhere. */
export const glow = (color: string, strength = 1): string =>
	`0 0 ${8 * strength}px ${color}, 0 0 ${24 * strength}px ${color}, 0 0 ${48 * strength}px ${color}`; // 3 blurred layers

/** Local: time inside a scene. Global: scenes need absolute song time (for lyrics/beats) and local progress. */
export const useSceneClock = (section: Section) => {
	const frame = useCurrentFrame(); // frame relative to the enclosing <Sequence>
	const {fps} = useVideoConfig(); // composition fps
	const startFrame = Math.round(section.startS * fps); // same rounding as the <Sequence from>
	const t = (startFrame + frame) / fps; // absolute song time in seconds
	const local = frame / fps; // seconds since the scene started
	const length = Math.max(section.endS - section.startS, 1 / fps); // scene length (avoid /0)
	return {frame, fps, t, local, length, progress: Math.min(1, local / length)}; // progress 0..1
};

/** Local: smoothstep easing 0..1. Global: soft reveals without importing extra easing code. */
export const smooth = (x: number): number => {
	const c = Math.min(1, Math.max(0, x)); // clamp
	return c * c * (3 - 2 * c); // Hermite smoothstep
};
