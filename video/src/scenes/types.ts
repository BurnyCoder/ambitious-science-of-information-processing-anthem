/**
 * Shared scene contract.
 * Local: every scene receives the whole timeline and its own section.
 * Global: Anthem.tsx mounts one scene per section inside a <Sequence>, so useCurrentFrame()
 * inside a scene is local to that section (https://www.remotion.dev/docs/sequence).
 */
import type {Section, Timeline} from '../lib/timeline'; // data contract

export type SceneProps = {tl: Timeline; section: Section}; // props of every scene component
