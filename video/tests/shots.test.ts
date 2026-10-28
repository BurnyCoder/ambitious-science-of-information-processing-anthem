/**
 * Tests for src/stage/shots.ts (run with `npm test`).
 * Local: one card emerges, is hero, recedes after its hero time, docks at its end and disappears at the cut;
 * a newer card takes over as hero and pushes the older one back; everything is deterministic.
 * Global: the stage draws every figure card from these states, so the phases must be right.
 */
import {test} from 'node:test'; // built-in runner
import assert from 'node:assert/strict'; // assertions
import {heroOf, heroness, shotsAt} from '../src/stage/shots.ts';

const card = (id: string, startS: number, endS: number, sectionIndex = 0) =>
	({id, lane: 'a', sectionIndex, lineIndex: 0, startS, endS, title: id, text: '', badge: 'schematic', cite: '', url: ''}) as const;
const sections = [{index: 0, label: 'Verse', kind: 'verse', occurrence: 1, scene: 'layers', startS: 0, endS: 20}];

test('one card: emerge, hero, recede, dock, gone at the cut', () => {
	const v = [card('a', 1, 7)];
	assert.equal(shotsAt(v, sections, 0.5).length, 0); // before its start
	const e = shotsAt(v, sections, 1.2)[0];
	assert.ok(e.emerge > 0 && e.emerge < 1 && e.rank === 0); // flying out of its object
	const h = shotsAt(v, sections, 3)[0];
	assert.equal(heroness(h), 1); // full hero
	assert.ok(shotsAt(v, sections, 5)[0].rank >= 1); // hero time (3.2 s) over: receded
	assert.equal(shotsAt(v, sections, 8)[0].dock, 1); // docked after its end
	assert.equal(shotsAt(v, sections, 20).length, 0); // gone with its section
});

test('a newer card becomes hero and pushes the older one back', () => {
	const v = [card('old', 1, 9), card('new', 2, 9)];
	const s = shotsAt(v, sections, 2.6);
	assert.equal(heroOf(s)?.v.id, 'new');
	assert.ok(s.find((x) => x.v.id === 'old')!.rank >= 1);
	assert.deepEqual(shotsAt(v, sections, 2.6), s); // pure: same input, same output
	assert.equal(s.find((x) => x.v.id === 'new')!.k, 1); // second card of its section
});

test('cards of other sections do not push each other', () => {
	const v = [card('a', 1, 7, 0), card('b', 1.5, 7, 1)];
	assert.equal(shotsAt(v, [...sections, {...sections[0], index: 1, startS: 0, endS: 20}], 2)[0].rank, 0);
});
