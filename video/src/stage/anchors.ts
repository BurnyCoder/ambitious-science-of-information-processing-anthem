/**
 * Where each figure card dives out of, and where it docks, per scene.
 * Local: anchorOf() returns a screen point (the scene object the lyric names) and a dock target:
 *  - a small thumbnail next to a rung, star, pillar, manifold, circuit node or halo slot;
 *  - "past": fly-through scenes, where the card flies past the camera.
 *  Geometry is imported from the scenes themselves, so anchors follow what is drawn (the atlas stars even rotate).
 * Global: Shot.tsx flies cards from the anchor to centre stage and back, and Anthem pushes the camera toward the
 * hero's anchor, so every concrete example visibly comes from, and returns to, the general picture.
 */
import type {Section, Timeline, Vignette} from '../lib/timeline';
import {ladderRung, rungAnchor} from '../scenes/LadderScene';
import {FIELDS, projectStar} from '../scenes/AtlasScene';
import {landscapeAnchor} from '../scenes/LandscapeScene';
import {CHORUS_NODES, chorusNode} from '../scenes/ChorusScene';
import {MANIFOLD_X, MANIFOLD_OF} from '../scenes/ManifoldsScene';
import {PLOT} from '../scenes/TheoryScene';

export type Dock = {kind: 'thumb'; x: number; y: number; s: number} | {kind: 'past'};
export type Anchor = {x: number; y: number; dock: Dock};

const PAST: Dock = {kind: 'past'};
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11); // stable small hash

/** Local: anchor of card v (k-th card of its section) at song time t. Global: dive origin + dock target. */
export const anchorOf = (tl: Timeline, section: Section, v: Vignette, k: number, t: number): Anchor => {
	switch (section.scene) {
		case 'intro':
			return {x: 960, y: 615, dock: PAST}; // the title, which condenses into the tokens card
		case 'layers':
			return {x: v.lane === 'b' ? 1110 : 810, y: 470, dock: PAST}; // the layer stack on the panel's side of the vanishing point
		case 'landscape':
			const q = landscapeAnchor(v.id, t - section.startS, Math.min(1, (t - section.startS) / (section.endS - section.startS)));
			return {x: q.x, y: q.y, dock: PAST}; // the surface point the figure explains
		case 'chorus': {
			const n = chorusNode(hash(`${v.id}${v.startS}`) % CHORUS_NODES); // a node of the network
			return {x: n.x, y: n.y, dock: {kind: 'thumb', x: n.x, y: n.y, s: 0.12}};
		}
		case 'ladder': {
			const rung = ladderRung(tl, section, v);
			const below = tl.vignettes.filter((u) => u.sectionIndex === v.sectionIndex && u.lane !== 'scene' && u.startS < v.startS && ladderRung(tl, section, u) === rung).length;
			const a = rungAnchor(rung); // the end of the rung's label (or the book)
			return {x: a.x, y: a.y, dock: {kind: 'thumb', x: a.x + 46 + below * 70, y: a.y, s: 0.1}}; // chips at the rung, before the panels
		}
		case 'manifolds': {
			const before = (u: Vignette) => tl.vignettes.filter((w) => w.sectionIndex === u.sectionIndex && w.startS < u.startS).length; // order in section
			const mOf = (u: Vignette) => MANIFOLD_OF[u.id] ?? before(u) % 3; // ring, helix or globe (unlisted cards take turns)
			const m = mOf(v);
			const below = tl.vignettes.filter((u) => u.sectionIndex === v.sectionIndex && u.startS < v.startS && mOf(u) === m).length;
			return {x: MANIFOLD_X[m], y: 540, dock: {kind: 'thumb', x: MANIFOLD_X[m] + (below - 1) * 125, y: 812, s: 0.19}};
		}
		case 'theory': { // the slot's figures (learning mechanics, GPT-4's prediction) belong to the scaling plot under them
			const x = PLOT.x + PLOT.w * 0.62, y = PLOT.y + PLOT.h * 0.4;
			return {x, y, dock: {kind: 'thumb', x: PLOT.x + PLOT.w - 60 - k * 90, y: PLOT.y + 40, s: 0.12}};
		}
		case 'atlas': {
			const f = FIELDS.findIndex(([, re]) => re !== null && re.test(v.title)); // the star of the sung field
			const local = t - section.startS;
			if (f >= 0) {
				const p = projectStar(f, local);
				return {x: p.x, y: p.y, dock: {kind: 'thumb', x: p.x + 70, y: p.y + 42, s: 0.11 + 0.05 * p.s}};
			}
			return {x: 960, y: 400, dock: PAST}; // cards with no star (carbon · silicon · stars) belong to the whole sphere
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
