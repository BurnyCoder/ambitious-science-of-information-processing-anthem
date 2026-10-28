/**
 * Typed access to stage/layout.json: where each scene puts its figure panels.
 * Local: a scene's accent colour, lyric band, panel slots ([x, y, w, h]; lane a = slot 0, lane b = slot 1) and the
 * protected regions (its key objects) that no panel may cover; plus the native card size the slots scale.
 * Global: StageLayer and Anthem read it; scripts/analysis/shots.py and tests/test_layout.py read the same JSON, so
 * the geometry exp09 checks is exactly the geometry drawn.
 */
import data from './layout.json'; // shared with Python (json.load) and the tests

export type Rect = [number, number, number, number]; // x, y, w, h on the 1920x1080 frame
export type SceneLayout = {accent: string; band: 'lyrics' | 'bigLyrics'; slots: Rect[]; protect: Rect[]};
export const CARD = data.card; // native card size {w, h} a slot scales
const SCENES = data.scenes as unknown as Record<string, SceneLayout>; // per-scene layouts

/** Local: the layout of a scene id (unknown ids fall back to `default`). Global: slots, accent and lyric band. */
export const sceneLayout = (scene: string): SceneLayout => SCENES[scene] ?? SCENES.default;

/** Local: centre and scale of a card drawn into rect r (fits the 600 x 350 card inside the slot). Global: panel pose. */
export const fit = (r: Rect) => ({x: r[0] + r[2] / 2, y: r[1] + r[3] / 2, s: Math.min(r[2] / CARD.w, r[3] / CARD.h)});

/** Local: the frame rects drawn by the layout debug overlay. Global: `stills.mjs --layout`. */
export const debugRects = (scene: string) => {
	const l = sceneLayout(scene);
	return [...l.slots.map((r) => ({r, kind: 'slot'})), ...l.protect.map((r) => ({r, kind: 'protect'})),
		...[data.bands.hud, data.bands.ticker, data.bands[l.band]].map((r) => ({r: r as Rect, kind: 'band'}))];
};
