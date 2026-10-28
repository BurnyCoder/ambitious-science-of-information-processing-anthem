/**
 * Tests for src/stage/shots.ts (run with `npm test`).
 * Local: a panel card emerges from its object, stays in its slot for its whole time, docks after its end and is gone
 * at the cut; lanes map to slots; "scene" cards are left to their scene (cardsOn); everything is deterministic.
 * Global: the stage draws every panel from these states (v1.5.0: no hero, no stealing), and tests/test_integration.py
 * repeats these cases for the Python mirror.
 */
import {test} from 'node:test'; // built-in runner
import assert from 'node:assert/strict'; // assertions
import {cardsOn, shotsAt} from '../src/stage/shots.ts';

const card = (id: string, startS: number, endS: number, lane = 'a', sectionIndex = 0) =>
	({id, lane, sectionIndex, lineIndex: 0, startS, endS, title: id, text: '', badge: 'schematic', cite: '', url: ''}) as const;
const sections = [{index: 0, label: 'Verse', kind: 'verse', occurrence: 1, scene: 'ladder', startS: 0, endS: 20}];

test('a panel stays in its slot for its whole time, then docks', () => {
	const v = [card('a', 1, 7)];
	assert.equal(shotsAt(v, sections, 0.5).length, 0); // before its start
	const e = shotsAt(v, sections, 1.2)[0];
	assert.ok(e.emerge > 0 && e.emerge < 1 && e.dock === 0); // flying out of its object
	for (const t of [2, 4, 6.9]) assert.deepEqual([shotsAt(v, sections, t)[0].emerge, shotsAt(v, sections, t)[0].dock], [1, 0]); // in its slot until its end
	assert.equal(shotsAt(v, sections, 8)[0].dock, 1); // docked after its end
	assert.equal(shotsAt(v, sections, 20).length, 0); // gone with its section
});

test('a newer card never pushes an older one out of its slot', () => {
	const v = [card('old', 1, 9, 'a'), card('new', 2, 9, 'b')];
	const s = shotsAt(v, sections, 3);
	assert.deepEqual(s.map((x) => [x.v.id, x.slot, x.emerge, x.dock]), [['old', 0, 1, 0], ['new', 1, 1, 0]]); // both fully shown
	assert.deepEqual(shotsAt(v, sections, 3), s); // pure: same input, same output
	assert.equal(s[1].k, 1); // second card of its section
});

test('scene cards are drawn by their scene, not the stage', () => {
	const v = [card('chip', 1, 5, 'scene'), card('p', 1, 5, 'a')];
	assert.deepEqual(shotsAt(v, sections, 2).map((x) => x.v.id), ['p']);
	const on = cardsOn(v, 0, 2);
	assert.deepEqual(on.map((x) => [x.v.id, x.k, x.on]), [['chip', 0, 1]]); // k counts the section's scene cards
	assert.ok(cardsOn(v, 0, 5.2)[0].on < 1 && cardsOn(v, 0, 5.6).length === 0); // fades out over DOCK_S after its end
	assert.equal(cardsOn(v, 1, 2).length, 0); // other sections see nothing
});
