/**
 * Shot lifecycle of the figure cards: a pure function of time.
 * Local: every placed card (timeline.json "vignettes") goes through four phases:
 *  - emerge: 0.4 s out of the scene object its lyric names;
 *  - hero: centre stage while it is the newest card, for at most 3.2 s;
 *  - orbit: a continuous rank >= 1 pushes it back in depth as newer cards arrive or its hero time runs out;
 *  - dock: 0.5 s after its end it flies back into its object and stays there until the section ends.
 *  Ranks are sums of eased steps, so cards glide between states instead of jumping. No imports at runtime,
 *  so `node --test tests/shots.test.ts` runs it.
 * Global: StageLayer draws each shot from these numbers and Anthem pushes the camera toward the hero's object
 * (heroPush), so the concrete examples live inside the scenes instead of in boxes beside them.
 */
import type {Section, Vignette} from '../lib/timeline';

export const EMERGE_S = 0.4; // flight out of the anchor object
export const HERO_MAX_S = 3.2; // the general scene gets the frame back after this, even without a new card
export const EASE_S = 0.4; // length of every rank change
export const DOCK_S = 0.5; // flight back into the anchor object

/** Local: Hermite smoothstep on a clamped input. Global: every eased step below. */
const ease = (x: number): number => {
	const c = Math.min(1, Math.max(0, x));
	return c * c * (3 - 2 * c);
};

/** Local: one card's state at t. emerge/dock in 0..1; rank 0 = hero, >= 1 = receded (continuous). */
export type Shot = {v: Vignette; fig: number; k: number; emerge: number; rank: number; dock: number};

/** Local: every card of the song that is visible at t (emerging, hero, orbiting, docking or docked).
 * k is the card's index within its section (anchors use it). Global: input of StageLayer and heroPush. */
export const shotsAt = (vignettes: Vignette[], sections: Section[], t: number): Shot[] => {
	const out: Shot[] = [];
	vignettes.forEach((v, i) => {
		const sectionEnd = sections.find((s) => s.index === v.sectionIndex)?.endS ?? v.endS; // docks live until the cut
		if (t < v.startS || t >= Math.max(sectionEnd, v.endS + DOCK_S)) return; // not yet, or gone with its section
		let rank = ease((t - v.startS - HERO_MAX_S) / EASE_S); // hero time ran out
		for (const n of vignettes) {
			if (n.sectionIndex !== v.sectionIndex || n.startS <= v.startS || n === v) continue; // only newer cards of the section push back
			rank += ease((t - n.startS) / EASE_S) - ease((t - n.endS) / EASE_S); // a newer card arrived / left
		}
		const k = vignettes.filter((u) => u.sectionIndex === v.sectionIndex && u.startS < v.startS).length; // order in its section
		out.push({v, fig: i + 1, k, emerge: ease((t - v.startS) / EMERGE_S), rank: Math.max(0, rank), dock: ease((t - v.endS) / DOCK_S)});
	});
	return out;
};

/** Local: how much a shot is "the hero" right now (0..1). Global: camera push and drawing order. */
export const heroness = (s: Shot): number => s.emerge * (1 - Math.min(1, s.rank)) * (1 - s.dock);

/** Local: the shot with the most hero weight, or null. Global: where the camera pushes in. */
export const heroOf = (shots: Shot[]): Shot | null => shots.reduce<Shot | null>((best, s) => (heroness(s) > (best ? heroness(best) : 0) ? s : best), null);
