/**
 * The generic card: the card's `text` typed in as large monospace math or prose.
 * Local: font size shrinks with the amount of text so it fits the body box.
 * Global: used for every catalog entry with id "formula" and for ids without a bespoke body.
 */
import React from 'react'; // JSX
import {Formula, type BodyProps} from './primitives'; // typed text

export const FormulaCard: React.FC<BodyProps> = ({v, local, w, h, accent}) => {
	const chars = v.text.length + 8 * v.text.split('\n').length; // text plus slack for line ends
	const word = Math.max(...v.text.split(/\s+/).map((s) => s.length), 1); // longest unbreakable run
	const size = Math.max(14, Math.min(28, 0.74 * Math.sqrt((w * h) / (chars * 0.6 * 1.35)), w / (word * 0.62))); // mono: 0.6 em wide, 1.35 em tall
	return (
		<div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center'}}>
			<Formula text={v.text} reveal={Math.min(1, local / 1.2)} size={size} color={accent} />
		</div>
	);
};
