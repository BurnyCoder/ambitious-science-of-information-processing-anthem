/**
 * Card registry: vignette id (content/vignettes.toml) -> body component.
 * Local: `showText: false` means the body itself renders the card's `text` (the generic formula card);
 * otherwise `text` is shown as a caption under the body. Unknown ids fall back to the formula card.
 * Global: stage/Shot.tsx looks every card on stage up here; one file per song section holds the bodies.
 */
import type React from 'react'; // component type
import type {BodyProps} from './primitives'; // card body contract
import {FormulaCard} from './formula'; // generic card
import {Activations, Backprop, Induction, Matmul, Regions, Residual, Scale} from './verse1';
import {Concentration, Curves, DoubleDescent, Flat, Grokking, Saddle} from './prechorus1';
import {GoldenGate, GraphCalc, GraphDallas, GraphGemma, GraphRabbit, Ioi, Patching, Sae} from './chorus';
import {DayCircle, Encyclopedia, GrokClock, NeuronFeature, Othello, ParamDecomp, Refusal, Rome, Shoggoth} from './verse2';
import {Bsf, FunctionVector, Polysemantic, ProbeR2, Superposition, Truth, WorldMap} from './prechorus2';
import {Collapse, Gpt4, Nngp, Saxe, WeightDecay} from './verse3';
import {Category, Mp, Pearl, Substrates} from './bridge';
import {Actadd, Arc, Checklist, Dag, KProgram, Milestones, Tokens} from './finale';

export type VignetteEntry = {Body: React.FC<BodyProps>; showText?: boolean}; // registry row
export const FALLBACK: VignetteEntry = {Body: FormulaCard, showText: false}; // title + typed text

const bodies: Record<string, React.FC<BodyProps>> = {
	tokens: Tokens, matmul: Matmul, activations: Activations, scale: Scale, regions: Regions, residual: Residual, induction: Induction, backprop: Backprop,
	concentration: Concentration, saddle: Saddle, flat: Flat, doubleDescent: DoubleDescent, grokking: Grokking, curves: Curves,
	sae: Sae, graphDallas: GraphDallas, patching: Patching, ioi: Ioi, graphCalc: GraphCalc, goldenGate: GoldenGate, graphGemma: GraphGemma,
	neuronFeature: NeuronFeature, dayCircle: DayCircle, paramDecomp: ParamDecomp, grokClock: GrokClock, othello: Othello, refusal: Refusal,
	shoggoth: Shoggoth, encyclopedia: Encyclopedia, rome: Rome, graphRabbit: GraphRabbit,
	superposition: Superposition, polysemantic: Polysemantic, bsf: Bsf, functionVector: FunctionVector, truth: Truth, worldMap: WorldMap, probeR2: ProbeR2,
	saxe: Saxe, nngp: Nngp, weightDecay: WeightDecay, collapse: Collapse, gpt4: Gpt4,
	mp: Mp, category: Category, pearl: Pearl, substrates: Substrates,
	checklist: Checklist, arc: Arc, kProgram: KProgram, dag: Dag, actadd: Actadd, milestones: Milestones,
};

const NO_CAPTION = new Set(['graphDallas', 'graphRabbit', 'graphCalc', 'checklist']); // bodies that already show their text

export const VIGNETTES: Record<string, VignetteEntry> = {
	formula: FALLBACK,
	...Object.fromEntries(Object.entries(bodies).map(([id, Body]) => [id, {Body, showText: !NO_CAPTION.has(id)}])), // caption under each body
};
