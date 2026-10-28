/**
 * Tests for src/stage/rewind.ts (run with `npm test`), on the real timeline.
 * Local: the outro's flying rewind starts at the outro, cuts on an accelerating beat grid, plays every cut backwards,
 * visits every earlier section, lands on the opening token as the last line ends, and never shows
 * more than two copies of the video at once.
 * Global: Anthem renders the rewind from these numbers; exp09 lists them.
 */
import {test} from 'node:test'; // built-in runner
import assert from 'node:assert/strict'; // assertions
import fs from 'node:fs'; // the real timeline
import {TOKEN_SRC, rewindAt, rewindPlan} from '../src/stage/rewind.ts';

const tl = JSON.parse(fs.readFileSync(new URL('../public/timeline.json', import.meta.url), 'utf-8'));
const plan = rewindPlan(tl)!;
const outro = tl.sections.find((s: {scene: string}) => s.scene === 'outro');

test('the rewind spans the outro, cut by cut, and lands on the token', () => {
	assert.equal(plan.start, outro.startS); // starts with the outro
	assert.equal(plan.end, tl.lines[tl.lines.length - 1].endS); // ends with the last sung word
	plan.cuts.forEach((c, i) => { // contiguous, backwards
		if (i) assert.ok(Math.abs(c.from - plan.cuts[i - 1].to) < 1e-9); // contiguous
		assert.ok(c.src0 > c.src1 && c.src1 > 0); // every cut plays backwards, never before the start of the song
	});
	assert.equal(plan.cuts[plan.cuts.length - 1].to, plan.end);
	assert.equal(plan.cuts[plan.cuts.length - 1].src1, TOKEN_SRC); // lands on the opening token, fully popped in
});

test('cuts speed up and every earlier section is visited', () => {
	const grid = plan.cuts.slice(0, -1).map((c) => c.to - c.from); // all but the landing
	grid.forEach((d, i) => i && assert.ok(d <= grid[i - 1] + 1e-9)); // intervals never grow
	assert.ok(grid[0] > 2.5 * grid[grid.length - 1]); // it accelerates (1 beat -> 1/4 beat)
	for (const s of tl.sections.filter((x: {scene: string}) => x.scene !== 'outro')) // each section appears in some cut
		assert.ok(plan.cuts.some((c) => c.src1 < s.endS && c.src0 > s.startS), s.label);
});

test('at most two copies, the incoming one behind the outgoing one', () => {
	for (let t = plan.start; t < plan.end; t += 1 / 30) {
		const copies = rewindAt(plan, t);
		assert.ok(copies.length >= 1 && copies.length <= 2);
		if (copies.length === 2) assert.ok(copies[1].opacity <= 1 && copies[1].scale > copies[0].scale); // the old frame flies past
	}
	assert.deepEqual(rewindAt(plan, plan.start - 1), []); // nothing before the outro
});

test('a moment early in the song still plays backwards', () => {
	const toy = {tempoBpm: 120, downbeats: Array.from({length: 20}, (_, i) => i * 2), vignettes: [{startS: 2, endS: 4}, {startS: 12, endS: 14}],
		sections: [{index: 0, scene: 'intro', startS: 0, endS: 1}, {index: 1, scene: 'layers', startS: 1, endS: 20}, {index: 2, scene: 'outro', startS: 20, endS: 40}],
		lines: [{endS: 36}]};
	const p = rewindPlan(toy as never)!;
	p.cuts.forEach((c) => assert.ok(c.src0 > c.src1, `${c.src0} > ${c.src1}`)); // a moment at 3 s must not run forwards
});
