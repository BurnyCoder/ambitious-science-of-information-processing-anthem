/**
 * Life of a figure card: a pure function of time (v1.5.0).
 * Local: a panel card (lane a or b) emerges from its scene object over EMERGE_S, stays in its slot (stage/layout.json)
 * for its whole time [startS, endS), then docks back into the object over DOCK_S and stays docked until its section
 * ends. Nothing steals a slot: lanes never overlap (anthem/vignettes.py trims within a lane). A "scene" card is
 * drawn by its own scene in place; cardsOn() tells the scene which of its cards are on and how far faded in.
 * No imports at runtime, so `node --test tests/shots.test.ts` runs it; scripts/analysis/shots.py mirrors it.
 * Global: StageLayer draws the panels from shotsAt(); scenes draw their own cards from cardsOn().
 */
import type {Section, Vignette} from '../lib/timeline';

export const EMERGE_S = 0.4; // flight out of the anchor object
export const DOCK_S = 0.5; // flight back into the anchor object (or fade, for scene cards)
export const LANES = ['a', 'b']; // lane a -> slot 0, lane b -> slot 1

/** Local: Hermite smoothstep on a clamped input. Global: every eased step below. */
const ease = (x: number): number => {
	const c = Math.min(1, Math.max(0, x));
	return c * c * (3 - 2 * c);
};

/** Local: one panel's state at t. emerge/dock in 0..1; slot indexes the scene's layout slots. */
export type Shot = {v: Vignette; fig: number; k: number; slot: number; emerge: number; dock: number};

/** Local: every panel of the song visible at t (emerging, in its slot, docking or docked); k = order in its section.
 * Global: input of StageLayer. */
export const shotsAt = (vignettes: Vignette[], sections: Section[], t: number): Shot[] => {
	const out: Shot[] = [];
	vignettes.forEach((v, i) => {
		if (v.lane === 'scene') return; // drawn by its scene
		const sectionEnd = sections.find((s) => s.index === v.sectionIndex)?.endS ?? v.endS; // docks live until the cut
		if (t < v.startS || t >= Math.max(sectionEnd, v.endS + DOCK_S)) return; // not yet, or gone with its section
		const k = vignettes.filter((u) => u.sectionIndex === v.sectionIndex && u.lane !== 'scene' && u.startS < v.startS).length; // order in its section
		out.push({v, fig: i + 1, k, slot: LANES.indexOf(v.lane), emerge: ease((t - v.startS) / EMERGE_S), dock: ease((t - v.endS) / DOCK_S)});
	});
	return out;
};

/** Local: the "scene" cards of a section that are on at t, with `on` easing in over EMERGE_S and out over DOCK_S;
 * k = order among the section's scene cards. Global: scenes that draw their own figures (atlas chips, theory blocks…). */
export const cardsOn = (vignettes: Vignette[], sectionIndex: number, t: number) => {
	const own = vignettes.filter((v) => v.lane === 'scene' && v.sectionIndex === sectionIndex); // in start order
	return own.flatMap((v, k) => (t >= v.startS && t < v.endS + DOCK_S
		? [{v, k, on: ease((t - v.startS) / EMERGE_S) * (1 - ease((t - v.endS) / DOCK_S))}] : []));
};
