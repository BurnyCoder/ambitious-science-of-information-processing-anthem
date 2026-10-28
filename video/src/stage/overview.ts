/**
 * The finale's overview: everything the video showed, on one screen (v1.6.0).
 * Local: at the rewind's landing downbeat the intro's token bursts into a 4 x 3 mosaic; ten tiles fly out of it, one
 * per earlier section, each a frozen copy of the video at that section's richest moment (the most figure cards on
 * screen) that keeps playing on at half speed; the two centre cells stay free for the closing statement. Pure: no
 * imports at runtime, so `node --test tests/overview.test.ts` runs it.
 * Global: stage/OverviewLayer.tsx draws the tiles (Remotion <Freeze> copies of World) and the celebration around them;
 * OutroScene draws the token and the statement in CENTRE.
 * Sources: https://www.remotion.dev/docs/freeze
 */
import type {Timeline} from '../lib/timeline';

type Rect = [number, number, number, number]; // x, y, w, h on the 1920 x 1080 frame
export type Tile = {sectionIndex: number; src: number; rect: Rect; delay: number};
const AREA = {x: 16, y: 80, w: 1888, h: 960, gap: 12, cols: 4, rows: 3}; // under the HUD, above the ticker
const FREE = [5, 6]; // the two centre cells (row-major), left to the statement
export const FLY_S = 0.8; // a tile's flight from the token to its cell
export const SLOW = 0.5; // tiles play on at half speed
export const FADE_S = 1.5; // the fade to black at the very end
export const TOKEN = {x: 955, y: 341}; // the intro's token at 1.2 s (IntroScene: a 26 px cell centred on x = 960, top 330)

const ease = (x: number): number => { // Hermite smoothstep on a clamped input
	const c = Math.min(1, Math.max(0, x));
	return c * c * (3 - 2 * c);
};
const cell = (i: number): Rect => { // cell i of the grid, row-major
	const w = (AREA.w - (AREA.cols - 1) * AREA.gap) / AREA.cols, h = (AREA.h - (AREA.rows - 1) * AREA.gap) / AREA.rows;
	return [AREA.x + (i % AREA.cols) * (w + AREA.gap), AREA.y + Math.floor(i / AREA.cols) * (h + AREA.gap), w, h];
};
/** Local: the centre rectangle (the two free cells). Global: where OutroScene puts the token and the statement. */
export const CENTRE: Rect = [cell(FREE[0])[0], cell(FREE[0])[1], cell(FREE[1])[0] + cell(FREE[1])[2] - cell(FREE[0])[0], cell(FREE[0])[3]];

/** Local: the moment of a section with the most figure cards on screen (latest on ties), sampled every 0.5 s and early
 * enough to keep playing at SLOW until the end without leaving the section. Global: what each tile shows. */
const richest = (tl: Timeline, s: {index: number; startS: number; endS: number}, hold: number) => {
	let best = s.startS + 1, most = -1;
	for (let t = s.startS + 1; t <= s.endS - 1.1 - hold * SLOW; t += 0.5) {
		const on = tl.vignettes.filter((v) => v.sectionIndex === s.index && v.startS <= t && t < v.endS).length;
		if (on >= most) [best, most] = [t, on];
	}
	return best;
};

/** Local: the overview from `start` (the rewind's landing downbeat) to the end of the video. Global: OverviewLayer.tsx. */
export const overviewPlan = (tl: Timeline, start: number) => {
	const end = tl.sections[tl.sections.length - 1].endS;
	const cells = Array.from({length: AREA.cols * AREA.rows}, (_, i) => i).filter((i) => !FREE.includes(i));
	const tiles: Tile[] = tl.sections.filter((s) => s.scene !== 'outro').slice(0, cells.length)
		.map((s, i) => ({sectionIndex: s.index, src: richest(tl, s, end - start), rect: cell(cells[i]), delay: 0.04 * i}));
	return {start, end, tiles};
};

/** Local: a tile's centre and flight progress k (0 at the token, 1 in its cell) at time t. Global: the burst. */
export const tilePose = (tile: Tile, start: number, t: number) => {
	const k = ease((t - start - tile.delay) / FLY_S), [x, y, w, h] = tile.rect;
	return {k, x: TOKEN.x + (x + w / 2 - TOKEN.x) * k, y: TOKEN.y + (y + h / 2 - TOKEN.y) * k};
};
