/**
 * The outro's flying rewind through the whole video: a pure schedule of cuts.
 * Local: from the outro's first frame to the downbeat before the last word, the video cuts on the beat to earlier
 * moments (the middle of every figure card and every section, latest first), each cut playing its moment backwards,
 * faster and faster (2x -> 12x) on shorter and shorter cuts (1 beat -> 1/4 beat); each new cut flies in while the
 * previous frame zooms past the camera. The last cut plays the intro backwards onto its single token (1.2 s in) as
 * the last line ends. No imports at runtime, so `node --test tests/rewind.test.ts` runs it.
 * Global: Anthem renders `<Freeze frame>` copies of the video at the source times rewindAt() returns.
 * Sources: https://www.remotion.dev/docs/freeze
 */
import type {Timeline} from '../lib/timeline';

export type Cut = {from: number; to: number; src0: number; src1: number}; // output [from, to) plays source src0 -> src1
export type RewindPlan = {start: number; land: number; end: number; cuts: Cut[]};
export type Copy = {key: number; src: number; scale: number; opacity: number; blur: number; split: number}; // one frozen copy

const ease = (x: number): number => { // Hermite smoothstep on a clamped input
	const c = Math.min(1, Math.max(0, x));
	return c * c * (3 - 2 * c);
};
const LANDING_SRC = 10; // the intro's last 10 s, played backwards onto the token
export const TOKEN_SRC = 1.2; // the intro moment where the single token has fully popped in (IntroScene: 1.2 s)

/** Local: the schedule of the rewind, or null without an outro. Global: Anthem (once per render) and its tests. */
export const rewindPlan = (tl: Timeline): RewindPlan | null => {
	const outro = tl.sections.find((s) => s.scene === 'outro');
	if (!outro) return null;
	const start = outro.startS, end = tl.lines[tl.lines.length - 1].endS; // the outro's sung part
	const landBeat = [...tl.downbeats].reverse().find((d) => d <= end - 0.6 && d > start + 4) ?? end - 1; // the landing downbeat
	const beat = 60 / tl.tempoBpm; // seconds per beat
	const bounds = [start];
	while (bounds[bounds.length - 1] < landBeat - 1e-6) { // 1 beat, then 1/2, then 1/4: the cuts speed up
		const b = bounds[bounds.length - 1], k = (b - start) / (landBeat - start);
		bounds.push(Math.min(landBeat, b + beat * (k < 0.3 ? 1 : k < 0.65 ? 0.5 : 0.25)));
	}
	if (bounds.length > 2 && bounds[bounds.length - 1] - bounds[bounds.length - 2] < beat * 0.2) bounds.pop(); // no sliver: the landing starts a moment earlier
	const land = bounds[bounds.length - 1]; // where the landing cut begins
	const marks = [...tl.vignettes.filter((v) => v.startS < start).map((v) => (v.startS + v.endS) / 2),
		...tl.sections.filter((s) => s.startS < start && s.startS > 0).map((s) => (s.startS + s.endS) / 2)].sort((a, b) => b - a); // latest first
	const n = bounds.length - 1;
	const cuts: Cut[] = bounds.slice(0, -1).map((from, i) => {
		const to = bounds[i + 1], m = marks[Math.round((i * (marks.length - 1)) / Math.max(1, n - 1))]; // spread over the whole song
		const span = (to - from) * (2 + 10 * (i / Math.max(1, n - 1))); // source seconds covered: 2x -> 12x speed
		return {from, to, src0: Math.min(start - 0.1, m + span / 2), src1: Math.max(LANDING_SRC + 0.5, m - span / 2)};
	});
	cuts.push({from: land, to: end, src0: LANDING_SRC, src1: TOKEN_SRC}); // the intro backwards onto its token
	return {start, land, end, cuts};
};

/** Local: the copies on screen at output time t: the current cut (behind) and, during the first 35 % of a cut, the
 * previous cut's last frame flying past the camera (in front). Global: Anthem's rewind layer. */
export const rewindAt = (plan: RewindPlan, t: number): Copy[] => {
	const i = plan.cuts.findIndex((c) => c.from <= t && t < c.to);
	if (i < 0) return [];
	const c = plan.cuts[i], u = (t - c.from) / (c.to - c.from); // progress through the cut
	const main: Copy = {key: i % 2, src: c.src0 + (c.src1 - c.src0) * u, scale: 0.72 + 0.28 * ease(u / 0.35) + 0.1 * u, opacity: i ? ease(u / 0.15) : 1, blur: 0, split: 1 - ease(u / 0.3)};
	if (!i || u >= 0.35) return [main];
	const out = ease(u / 0.35), prev = plan.cuts[i - 1];
	return [main, {key: (i - 1) % 2, src: prev.src1, scale: 1.1 + 1.5 * out, opacity: 1 - out, blur: 10 * out, split: 0}];
};
