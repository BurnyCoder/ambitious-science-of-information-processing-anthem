/**
 * Tests for src/stage/overview.ts (run with `npm test`), on the real timeline.
 * Local: the finale's overview bursts out of the token at the rewind's landing downbeat into ten tiles, one per earlier
 * section, each frozen at a moment inside its section; the tiles sit on screen, never overlap and leave the centre to
 * the closing statement; each flies from the token into its cell.
 * Global: Anthem draws the overview from these numbers (exp10 H4 measures its detail).
 */
import {test} from 'node:test'; // built-in runner
import assert from 'node:assert/strict'; // assertions
import fs from 'node:fs'; // the real timeline
import {CENTRE, TOKEN, overviewPlan, tilePose} from '../src/stage/overview.ts';
import {rewindPlan} from '../src/stage/rewind.ts';

const tl = JSON.parse(fs.readFileSync(new URL('../public/timeline.json', import.meta.url), 'utf-8'));
const start = rewindPlan(tl)!.end;
const plan = overviewPlan(tl, start);
type R = [number, number, number, number];
const overlap = (a: R, b: R) => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));

test('ten tiles, one per earlier section, each frozen inside its section', () => {
	const earlier = tl.sections.filter((s: {scene: string}) => s.scene !== 'outro');
	assert.equal(plan.start, start); // bursts at the landing downbeat
	assert.deepEqual(plan.tiles.map((x) => x.sectionIndex), earlier.map((s: {index: number}) => s.index));
	for (const x of plan.tiles) {
		const s = tl.sections[x.sectionIndex];
		assert.ok(s.startS < x.src && x.src + 0.5 * (plan.end - plan.start) < s.endS - 1, s.label); // still inside after playing on at half speed
	}
});

test('tiles are on screen, never overlap and leave the centre free', () => {
	for (const [i, a] of plan.tiles.entries()) {
		assert.ok(a.rect[0] >= 0 && a.rect[1] >= 0 && a.rect[0] + a.rect[2] <= 1920 && a.rect[1] + a.rect[3] <= 1080);
		assert.equal(overlap(a.rect, CENTRE), 0);
		plan.tiles.slice(i + 1).forEach((b) => assert.equal(overlap(a.rect, b.rect), 0));
	}
});

test('each tile flies out of the token into its cell', () => {
	const x = plan.tiles[3];
	assert.equal(tilePose(x, plan.start, plan.start - 0.1).k, 0); // not yet
	const early = tilePose(x, plan.start, plan.start + 0.01);
	assert.ok(Math.hypot(early.x - TOKEN.x, early.y - TOKEN.y) < 5); // starts at the token
	const late = tilePose(x, plan.start, plan.start + 3);
	assert.deepEqual([late.k, late.x, late.y], [1, x.rect[0] + x.rect[2] / 2, x.rect[1] + x.rect[3] / 2]); // settled in its cell
});
