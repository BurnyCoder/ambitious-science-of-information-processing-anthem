/**
 * Scene registry: scene id (from content/scenes.toml) -> component + HUD caption.
 * Local: one entry per visual scene; in `bigLyrics` scenes Anthem draws giant lyrics in the lower third,
 * so the bottom karaoke overlay is hidden there.
 * Global: Anthem.tsx looks up each timeline section's `scene` here; unknown ids fall back to `default`.
 */
import type React from 'react'; // component type
import type {SceneProps} from './types'; // contract
import {IntroScene} from './IntroScene';
import {LayersScene} from './LayersScene';
import {LandscapeScene} from './LandscapeScene';
import {ChorusScene} from './ChorusScene';
import {LadderScene} from './LadderScene';
import {ManifoldsScene} from './ManifoldsScene';
import {TheoryScene} from './TheoryScene';
import {AtlasScene} from './AtlasScene';
import {FinaleScene} from './FinaleScene';
import {OutroScene} from './OutroScene';

export type SceneEntry = {component: React.FC<SceneProps>; caption: string; bigLyrics?: boolean}; // registry row

const Empty: React.FC<SceneProps> = () => null; // background-only fallback

export const SCENES: Record<string, SceneEntry> = {
	intro: {component: IntroScene, caption: 'ONE TOKEN'},
	layers: {component: LayersScene, caption: 'MATMUL ∘ NONLINEARITY'},
	landscape: {component: LandscapeScene, caption: 'LOSS LANDSCAPE'},
	chorus: {component: ChorusScene, caption: 'CIRCUITS', bigLyrics: true},
	ladder: {component: LadderScene, caption: 'LADDER OF ABSTRACTION'},
	manifolds: {component: ManifoldsScene, caption: 'FEATURE GEOMETRY'},
	theory: {component: TheoryScene, caption: 'LEARNING MECHANICS'},
	atlas: {component: AtlasScene, caption: 'ATLAS OF THE MATH'},
	finale: {component: FinaleScene, caption: 'IDEAL SOLVING', bigLyrics: true},
	outro: {component: OutroScene, caption: 'UNDERSTAND'},
	default: {component: Empty, caption: ''},
};
