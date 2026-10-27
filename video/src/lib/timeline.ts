/**
 * Typed view of public/timeline.json plus pure lookup helpers.
 * Local: the TypeScript mirror of the dict built by anthem/timeline.py, and O(log n)
 * helpers to ask "which section/line/word/beat is active at time t".
 * Global: every scene and overlay calls these with t = frame / fps, so the whole video
 * is a deterministic function of the frame number (Remotion's rendering model:
 * https://www.remotion.dev/docs/the-fundamentals).
 */

export type Word = {text: string; startS: number; endS: number; backing: boolean}; // one karaoke unit
export type Line = {index: number; sectionIndex: number; text: string; startS: number; endS: number; backing: boolean; words: Word[]}; // one caption
export type Section = {index: number; label: string; kind: string; occurrence: number; scene: string; startS: number; endS: number}; // one scene slot
export type Badge = 'released data' | 'published numbers' | 'live math' | 'from the paper' | 'schematic'; // provenance label
export type Vignette = {
	id: string; slot: string; sectionIndex: number; lineIndex: number; startS: number; endS: number; // what/where/when
	title: string; text: string; badge: Badge; cite: string; url: string; // what it says and where it comes from
}; // one figure card (content/vignettes.toml placed by anthem/vignettes.py)
export type Timeline = {
	version: number; // schema version (2: adds slots + vignettes)
	title: string; // song title
	fps: number; // frames per second
	audio: string; // file name inside public/
	durationS: number; // song length
	durationInFrames: number; // composition length
	tempoBpm: number; // measured tempo
	sections: Section[]; // scenes in order
	lines: Line[]; // captions in order
	beats: number[]; // beat times (s)
	downbeats: number[]; // every 4th beat (s)
	energy: number[]; // RMS per frame, 0..1
	onset: number[]; // onset strength per frame, 0..1
	meta: Record<string, unknown>; // provenance (task/take ids, alignment stats)
	slots: Record<string, [number, number, number, number]>; // card boxes [x, y, w, h] in frame pixels
	vignettes: Vignette[]; // figure cards sorted by startS
};

/** Local: cards on screen at t (a card in a slot ends where the next one in that slot starts). Global: VignetteLayer. */
export const activeVignettes = (tl: Timeline, t: number): Vignette[] => tl.vignettes.filter((v) => v.startS <= t && t < v.endS);

/** Local: index of the last element <= t in a sorted array (-1 if none). Global: shared binary search. */
export const lastIndexAtOrBefore = (sorted: number[], t: number): number => {
	let lo = 0; // inclusive lower bound
	let hi = sorted.length - 1; // inclusive upper bound
	let ans = -1; // nothing found yet
	while (lo <= hi) {
		const mid = (lo + hi) >> 1; // integer midpoint
		if (sorted[mid] <= t) {
			ans = mid; // candidate, look right for a later one
			lo = mid + 1;
		} else {
			hi = mid - 1; // too late, look left
		}
	}
	return ans;
};

/** Local: seconds since the most recent beat in `beats` (Infinity before the first). Global: drives pulses. */
export const sinceBeat = (beats: number[], t: number): number => {
	const i = lastIndexAtOrBefore(beats, t); // latest beat not after t
	return i < 0 ? Infinity : t - beats[i]; // elapsed seconds
};

/** Local: exponential decay 1 -> 0 after each beat. Global: beat-synced flashes/scales without state. */
export const beatPulse = (beats: number[], t: number, decayS = 0.18): number => Math.exp(-sinceBeat(beats, t) / decayS); // e^(-dt/tau)

/** Local: per-frame feature (energy/onset) at time t, clamped to the array. Global: audio-reactive amplitude. */
export const featureAt = (values: number[], fps: number, t: number): number => {
	if (values.length === 0) return 0; // no data (fixture without audio)
	const i = Math.min(values.length - 1, Math.max(0, Math.round(t * fps))); // nearest video frame
	return values[i];
};

/** Local: the caption to show at t (null between lines). Global: drives the karaoke overlay. */
export const lineAt = (tl: Timeline, t: number, leadS = 0.35, holdS = 1.2): Line | null => {
	const starts = tl.lines.map((l) => l.startS - leadS); // lines appear slightly before they are sung
	const i = lastIndexAtOrBefore(starts, t); // latest line that has appeared
	if (i < 0) return null; // before the first line
	const line = tl.lines[i]; // candidate
	const next = tl.lines[i + 1]; // following caption, if any
	const until = next ? Math.min(line.endS + holdS, next.startS - leadS) : line.endS + holdS; // hand over or fade
	return t <= Math.max(until, line.endS) ? line : null; // keep while sung, then hold briefly
};

/** Local: index of the word being sung at t within a line (-1 before, words.length after). Global: highlight. */
export const activeWordIndex = (line: Line, t: number): number => {
	const i = lastIndexAtOrBefore(line.words.map((w) => w.startS), t); // last started word
	if (i >= 0 && t > line.words[line.words.length - 1].endS) return line.words.length; // line finished
	return i;
};

/** Local: lines that belong to one section. Global: scenes that react to their own lyrics (ladder, atlas). */
export const sectionLines = (tl: Timeline, section: Section): Line[] => tl.lines.filter((l) => l.sectionIndex === section.index);

/** Local: first time a word matching `re` is sung inside `section`, or null. Global: keyword-triggered reveals. */
export const wordTime = (tl: Timeline, section: Section, re: RegExp): number | null => {
	for (const line of sectionLines(tl, section)) {
		for (const w of line.words) {
			if (re.test(w.text)) return w.startS; // first match in sung order
		}
	}
	return null;
};

/** Local: frame number of a time in seconds. Global: converts timeline seconds to <Sequence> frames. */
export const toFrame = (s: number, fps: number): number => Math.round(s * fps);
