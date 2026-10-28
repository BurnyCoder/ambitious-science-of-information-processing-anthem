/**
 * Where each figure card dives out of, and where it docks, per scene.
 * Local: anchorOf() returns a screen point (the scene object the lyric names) and a dock target:
 *  - a small thumbnail next to a rung, star, pillar, manifold, circuit node or halo slot;
 *  - "past": fly-through scenes, where the card flies past the camera.
 *  Geometry is imported from the scenes themselves, so anchors follow what is drawn (the atlas stars even rotate).
 * Global: Shot.tsx flies cards from the anchor to centre stage and back, and Anthem pushes the camera toward the
 * hero's anchor, so every concrete example visibly comes from, and returns to, the general picture.
 */
import {wordTime, type Section, type Timeline, type Vignette} from '../lib/timeline';
import {BASE, LADDER_LEFT, RUNG_GAP, RUNGS, rungTimes} from '../scenes/LadderScene';
import {FIELDS, projectStar} from '../scenes/AtlasScene';
import {CHORUS_NODES, chorusNode} from '../scenes/ChorusScene';
import {MANIFOLD_X, MANIFOLD_OF} from '../scenes/ManifoldsScene';
import {PILLARS} from '../scenes/TheoryScene';

export type Dock = {kind: 'thumb'; x: number; y: number; s: number} | {kind: 'past'};
export type Anchor = {x: number; y: number; dock: Dock};

const PAST: Dock = {kind: 'past'};
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11); // stable small hash

/** Local: the rung a ladder card belongs to: the last rung sung by its start, or the "book" above the ladder
 * once "encyclopedia" has been sung. Global: ladder anchors and their stacking. */
const ladderRung = (tl: Timeline, section: Section, v: Vignette): number => {
	const encyclo = wordTime(tl, section, /encyclopedia/i);
	if (encyclo !== null && v.startS >= encyclo - 0.3) return RUNGS.length; // the encyclopedia sits above the top rung
	return Math.max(0, rungTimes(tl, section).filter((s) => s <= v.startS + 0.3).length - 1);
};

/** Local: anchor of card v (k-th card of its section) at song time t. Global: dive origin + dock target. */
export const anchorOf = (tl: Timeline, section: Section, v: Vignette, k: number, t: number): Anchor => {
	switch (section.scene) {
		case 'intro':
			return {x: 313, y: 411, dock: PAST}; // the token cell
		case 'layers':
			return {x: 960, y: 470, dock: PAST}; // the fly-through's vanishing point; cards fly past the camera
		case 'landscape':
			return {x: 960, y: 600, dock: PAST}; // the SGD swarm over the basin
		case 'chorus': {
			const n = chorusNode(hash(`${v.id}${v.startS}`) % CHORUS_NODES); // a node of the network
			return {x: n.x, y: n.y, dock: {kind: 'thumb', x: n.x, y: n.y, s: 0.12}};
		}
		case 'ladder': {
			const rung = ladderRung(tl, section, v);
			const below = tl.vignettes.filter((u) => u.sectionIndex === v.sectionIndex && u.startS < v.startS && ladderRung(tl, section, u) === rung).length;
			const y = BASE - rung * RUNG_GAP + 5; // rung height (the book sits one gap above the top rung)
			return {x: LADDER_LEFT + 64, y, dock: {kind: 'thumb', x: LADDER_LEFT - 70 - below * 125, y, s: 0.19}}; // thumbnails stack left of the rail
		}
		case 'manifolds': {
			const m = MANIFOLD_OF[v.id] ?? k % 3; // ring, helix or globe
			const below = tl.vignettes.filter((u) => u.sectionIndex === v.sectionIndex && u.startS < v.startS && (MANIFOLD_OF[u.id] ?? 0) === m).length;
			return {x: MANIFOLD_X[m], y: 540, dock: {kind: 'thumb', x: MANIFOLD_X[m] + (below - 1) * 125, y: 812, s: 0.19}};
		}
		case 'theory': {
			if (k < PILLARS.length) { // the five directions: out of the pillar, back into it
				const [x, y, w, h] = PILLARS[k];
				return {x: x + w / 2, y: y + 60, dock: {kind: 'thumb', x: x + w / 2, y: y + h / 2 + 30, s: (w - 12) / 600}};
			}
			return {x: 1490, y: 690, dock: {kind: 'thumb', x: 1300 + (k - PILLARS.length) * 330, y: 330, s: 0.24}}; // beside the scaling plot
		}
		case 'atlas': {
			const f = FIELDS.findIndex(([, re]) => re !== null && re.test(v.title)); // the star of the sung field
			const local = t - section.startS;
			if (f >= 0) {
				const p = projectStar(f, local);
				return {x: p.x, y: p.y, dock: {kind: 'thumb', x: p.x + 70, y: p.y + 42, s: 0.11 + 0.05 * p.s}};
			}
			const a = -Math.PI / 2 + k * 0.83; // other lenses take the outer ring
			const x = 960 + Math.cos(a) * 820, y = 520 + Math.sin(a) * 380;
			return {x, y, dock: {kind: 'thumb', x, y, s: 0.12}};
		}
		case 'finale': {
			const a = -Math.PI / 2 + k * (Math.PI / 4); // halo around the words
			return {x: 960, y: 380, dock: {kind: 'thumb', x: 960 + Math.cos(a) * 600, y: 400 + Math.sin(a) * 270, s: 0.14}};
		}
		case 'outro': {
			const a = k * 1.3; // out of the particle ring, back into the single token
			return {x: 960 + Math.cos(a) * 420, y: 470 + Math.sin(a) * 250, dock: {kind: 'thumb', x: 960, y: 470, s: 0.012}};
		}
		default:
			return {x: 960, y: 540, dock: PAST};
	}
};
