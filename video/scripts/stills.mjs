/**
 * Render selected frames of the Anthem composition to PNG (development + verification aid).
 * Local: bundles the project once, then renders each requested frame (or each section's midpoint
 * when no frames are given) to ../out/stills/.
 * Global: lets scenes be checked visually without a full 7k-frame render.
 * Usage: node scripts/stills.mjs [--layout] [frame ...]  |  --vignettes [sectionIndex ...]  |  --docks [sectionIndex ...]
 *        (--vignettes: one still per figure card 1.6 s after it appears, when it sits in its slot;
 *         --docks: one still per section 0.4 s before it ends, when its cards have docked into their objects;
 *         --layout: draw each scene's panel slots, protected regions and lyric bands over the stills)
 * Sources: https://www.remotion.dev/docs/bundle , https://www.remotion.dev/docs/renderer/render-still ,
 *          https://www.remotion.dev/docs/renderer/select-composition
 */
import path from 'node:path'; // absolute paths for the bundler
import fs from 'node:fs'; // read timeline + mkdir
import {bundle} from '@remotion/bundler'; // webpack bundle of src/
import {renderStill, selectComposition} from '@remotion/renderer'; // headless Chrome rendering

const chromiumOptions = {gl: 'angle'}; // WebGL backend required for Three.js scenes
const outDir = path.resolve('..', 'out', 'stills'); // repo-level out/stills
fs.mkdirSync(outDir, {recursive: true}); // ensure it exists
const tl = JSON.parse(fs.readFileSync('public/timeline.json', 'utf-8')); // to compute section midpoints
const debugLayout = process.argv.includes('--layout'); // overlay the stage layout (stage/layout.json)
const args = process.argv.slice(2).filter((a) => a !== '--layout'); // CLI arguments
const inputProps = {debugLayout}; // passed to the Anthem composition
const cards = args[0] === '--vignettes'; // one still per figure card
const docks = args[0] === '--docks'; // one still per section end
const only = args.slice(cards || docks ? 1 : 0).map(Number); // frames, or section indices with --vignettes / --docks
const targets = cards
	? tl.vignettes.map((v, i) => ({v, i})).filter(({v}) => !only.length || only.includes(v.sectionIndex))
		.map(({v, i}) => ({f: Math.round((v.startS + Math.min(1.6, 0.5 * (v.endS - v.startS))) * tl.fps), name: `fig${String(i + 1).padStart(2, '0')}_${v.id}`})) // in its slot
	: docks ? tl.sections.filter((s) => !only.length || only.includes(s.index))
		.map((s) => ({f: Math.round((s.endS - 0.4) * tl.fps), name: `dock${String(s.index + 1).padStart(2, '0')}_${s.scene}`})) // everything docked
	: only.length ? only.map((f) => ({f, name: `frame_${f}`}))
	: tl.sections.map((s, i) => ({f: Math.round(((s.startS + s.endS) / 2) * tl.fps), name: `s${String(i + 1).padStart(2, '0')}_${s.scene}`})); // midpoints
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')}); // bundle once
const composition = await selectComposition({serveUrl, id: 'Anthem', chromiumOptions, inputProps}); // runs calculateMetadata
for (const {f, name} of targets) {
	const output = path.join(outDir, `${name}${debugLayout ? '_layout' : ''}.png`); // destination
	await renderStill({composition, serveUrl, output, frame: f, chromiumOptions, inputProps}); // one frame
	console.log(`${new Date().toISOString()} still frame=${f} -> ${output}`); // timestamped progress
}
