/**
 * Intro: a single token glows, unfolds into an embedding vector, then the title card.
 * Local: 2D SVG/CSS, laid out centred; the GPT-2 token "know" (id 760, public/vignettes/tokens.json; GPT-2 small has d = 768) -> 16
 * embedding cells (cells slide out; bar lengths are illustrative seeded values, not the real weights)
 * -> "WE WILL KNOW" letter-by-letter -> subtitle and credits -> the title splits at its real GPT-2 token boundaries
 * (We | will | know: 1135 · 481 · 760) and condenses into the first figure card, which takes the title's place until
 * the cut, while the embedding column keeps streaming (the 768-d vector scrolling past) and verse 1's layers fly out of
 * the vanishing point behind the card, faster and faster: a match cut into the tunnel.
 * Global: first scene; sets the "information processing starts from one token" motif that the outro reverses.
 */
import React from 'react'; // JSX
import {AbsoluteFill, random} from 'remotion'; // layer + deterministic RNG
import {beatPulse} from '../lib/timeline'; // beat pulse
import tokens from '../../public/vignettes/tokens.json'; // the title's real GPT-2 tokens
import {COLORS, FONTS, glow, smooth, useSceneClock} from '../lib/theme'; // look + clock
import type {SceneProps} from './types'; // contract

const CELLS = 16; // embedding dimensions shown
const WORDS = tokens[0].tokens.map((s, i) => ({text: s.replace('Ġ', '').toUpperCase(), id: tokens[0].ids[i]})); // WE 1135 · WILL 481 · KNOW 760

export const IntroScene: React.FC<SceneProps> = ({tl, section}) => {
	const {t, local, length} = useSceneClock(section); // absolute + local time
	const pulse = beatPulse(tl.beats, t); // 1 at each beat, decays
	const unfold = smooth((local - 2.5) / 3.0); // token -> vector, 2.5..5.5 s
	const titleAt = Math.min(7, length * 0.4); // title starts by 7 s (or 40% of a short intro)
	const title = 'WE WILL KNOW'; // card text
	const shown = Math.floor(Math.max(0, (local - titleAt) / 0.12)); // one letter per 120 ms
	const exit = smooth((local - (length - 1.2)) / 1.2); // last 1.2 s: zoom out
	const tokenScale = smooth(local / 1.2) * (1 + 0.15 * pulse); // pop in, breathe on beats
	const tokensAt = tl.vignettes.find((v) => v.sectionIndex === section.index && v.id === 'tokens')?.startS ?? Infinity; // the title's tokens card
	const split = smooth((t - tokensAt) / 0.5); // the title breaks at its token boundaries
	const dissolve = smooth((t - tokensAt - 0.5) / 0.5); // then condenses into the card
	const stream = Math.max(0, t - tokensAt) * 60; // px the embedding column has scrolled since
	const warp = smooth((t - tokensAt - 1) / 1.5); // verse 1's layers start flying out of the vanishing point
	const fly = Math.max(0, t - tokensAt - 1) * (0.5 + 0.12 * Math.max(0, t - tokensAt - 1)); // accelerating depth travel
	const aside = smooth((t - tokensAt) / 0.8); // the column glides aside when the tokens card appears
	const colX = 960 + (300 - 960) * aside, colY = 330 + (400 - 330) * aside; // centred above the title (each row centres on colX), then left
	return (
		<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: 1 - exit * 0.8, transform: `scale(${1 + exit * 0.3})`}}>
			{warp > 0 ? <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}> {/* verse 1's layers (12 x 7 neurons) flying out of the vanishing point */}
				{Array.from({length: 10}, (_, k) => {
					const phase = (fly + k / 10) % 1, scale = 0.12 * Math.pow(15, phase); // depth -> size (perspective)
					const op = warp * smooth(phase * 4) * (1 - smooth((phase - 0.8) / 0.2));
					return Array.from({length: 84}, (_, i) => {
						const c = i % 12, r = Math.floor(i / 12), lit = random(`warp${k}-${i}-${Math.floor(fly + k / 10)}`) > 0.8;
						return <circle key={`${k}-${i}`} cx={960 + (c - 5.5) * 120 * scale} cy={470 + (r - 3) * 120 * scale} r={2 + 4 * scale}
							fill={lit ? COLORS.cyan : COLORS.violet} opacity={op * (lit ? 0.9 : 0.45)} />;
					});
				})}
			</svg> : null}
			{/* token and its unfolding vector */}
			<div style={{position: 'absolute', left: colX, top: colY, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 1 - smooth((local - titleAt) / 2) * 0.75 + 0.75 * warp}}>
				{Array.from({length: CELLS}, (_, i) => {
					const offset = (((i - (CELLS - 1) / 2) * 24 * unfold - stream) % (CELLS * 24) + CELLS * 36) % (CELLS * 24) - CELLS * 12; // spread, then scroll (wraps)
					const v = random(`emb${i}-${Math.floor(((i * 24 - stream) / (CELLS * 24)))}`) * 2 - 1; // seeded component; a new one each time the cell wraps
					return (
						<div key={i} style={{position: 'absolute', top: offset, display: 'flex', alignItems: 'center', opacity: i === 7 ? 1 : unfold}}>
							<div style={{width: 26, height: 22, borderRadius: 4, background: v > 0 ? COLORS.cyan : COLORS.magenta, opacity: 0.35 + 0.65 * Math.abs(v),
								boxShadow: `0 0 ${12 + 18 * pulse}px ${v > 0 ? COLORS.cyan : COLORS.magenta}`, transform: `scale(${i === 7 ? tokenScale : 1})`}} />
							<div style={{width: 160 * Math.abs(v) * unfold, height: 6, marginLeft: 10, background: COLORS.ink, opacity: 0.4}} />
						</div>
					);
				})}
				<div style={{position: 'absolute', top: 22 + 190 * unfold, left: 0, transform: 'translateX(-50%)', fontFamily: FONTS.mono, fontSize: 24, color: COLORS.dim, whiteSpace: 'nowrap', opacity: 1 - aside}}>{/* centred under the column */}
					{unfold < 0.5 ? '" know" = GPT-2 token 760' : '" know" (token 760) → embedding x ∈ ℝ⁷⁶⁸'}
				</div>
			</div>
			{/* title card: splits at its GPT-2 token boundaries (ids appear under each piece), then condenses into the tokens card */}
			<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 1 - dissolve, transform: `scale(${1 - 0.35 * dissolve})`, filter: dissolve > 0 ? `blur(${5 * dissolve}px)` : undefined}}>
				<div style={{marginTop: 260, display: 'flex', gap: `${0.3 + 0.15 * split}em`, fontFamily: FONTS.display, fontWeight: 900, fontSize: 150, letterSpacing: '0.08em', color: COLORS.ink, textShadow: glow(COLORS.cyan, 1 + 0.5 * pulse)}}>
					{WORDS.map((w, i) => { const before = WORDS.slice(0, i).reduce((n, x) => n + x.text.length + 1, 0); // letters typed before this token
						return <span key={i} style={{position: 'relative', outline: split > 0 ? `${3 * split}px solid rgba(34,228,255,${0.7 * split})` : undefined, borderRadius: 12,
							padding: '0 0.1em 0 0.18em'}}>{/* the extra left padding balances the letter-spacing after the last letter, so the row is centred */}
							{w.text.split('').map((ch, j) => ( // every letter is laid out from the start (invisible until typed): the title never shifts
								<span key={j} style={{position: 'relative', opacity: before + j < shown ? 1 : 0}}>{ch}
									{before + j === shown - 1 && shown < title.length ? <span style={{position: 'absolute', left: '100%', top: 0}}>▍</span> : null}{/* cursor takes no width */}
								</span>))}
							<span style={{position: 'absolute', left: 0, right: 0, top: '100%', fontFamily: FONTS.mono, fontSize: 34, fontWeight: 400, color: COLORS.cyan, textAlign: 'center', opacity: split}}>{w.id}</span>
						</span>; })}
				</div>
				<div style={{fontFamily: FONTS.body, fontSize: 36, color: COLORS.ink, opacity: smooth((local - titleAt - 2) / 1.2) * (1 - split), marginTop: 10}}>
					an anthem of ambitious science of information processing
				</div>
				<div style={{fontFamily: FONTS.mono, fontSize: 20, color: COLORS.dim, opacity: smooth((local - titleAt - 4) / 1.2) * (1 - split), marginTop: 26}}>
					song: Suno V6 · lyrics, code &amp; every frame: Claude · concept: Libor Burian
				</div>
			</div>
		</AbsoluteFill>
	);
};
