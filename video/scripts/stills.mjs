/**
 * Render selected frames of the Anthem composition to PNG (development + verification aid).
 * Local: bundles the project once, then renders each requested frame (or each section's midpoint
 * when no frames are given) to ../out/stills/.
 * Global: lets scenes be checked visually without a full 7k-frame render.
 * Usage: node scripts/stills.mjs [frame ...]   |   node scripts/stills.mjs --vignettes [sectionIndex ...]
 *        (--vignettes: one still at 60 % of each figure card's time on screen, optionally only some sections)
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
const args = process.argv.slice(2); // CLI arguments
const cards = args[0] === '--vignettes'; // one still per figure card
const only = args.slice(cards ? 1 : 0).map(Number); // frames, or section indices with --vignettes
const targets = cards
	? tl.vignettes.map((v, i) => ({v, i})).filter(({v}) => !only.length || only.includes(v.sectionIndex))
		.map(({v, i}) => ({f: Math.round((v.startS + 0.6 * (v.endS - v.startS)) * tl.fps), name: `fig${String(i + 1).padStart(2, '0')}_${v.id}`})) // 60 % in
	: only.length ? only.map((f) => ({f, name: `frame_${f}`}))
	: tl.sections.map((s, i) => ({f: Math.round(((s.startS + s.endS) / 2) * tl.fps), name: `s${String(i + 1).padStart(2, '0')}_${s.scene}`})); // midpoints
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')}); // bundle once
const composition = await selectComposition({serveUrl, id: 'Anthem', chromiumOptions}); // runs calculateMetadata
for (const {f, name} of targets) {
	const output = path.join(outDir, `${name}.png`); // destination
	await renderStill({composition, serveUrl, output, frame: f, chromiumOptions}); // one frame
	console.log(`${new Date().toISOString()} still frame=${f} -> ${output}`); // timestamped progress
}
