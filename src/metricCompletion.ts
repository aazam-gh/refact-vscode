/* eslint-disable @typescript-eslint/naming-convention */
const Diff = require('difflib');


import { simple_cleanup_cr_lf } from "./crlf";


export function get_diff_addition_blocks(state0: string, state1: string): [string, string] {
	state0 = simple_cleanup_cr_lf(state0);
	state1 = simple_cleanup_cr_lf(state1);

	let file1Lines: string[] = state0.split('\n');
	let file2Lines: string[] = state1.split('\n');

	const differ = new Diff.Differ();
	const diff = differ.compare(file1Lines, file2Lines);

	const diff_blocks: string[][] = [];
	let currentBlock: string[] = [];
	for (const part of diff) {
		if (part.startsWith('?')) {
			if (currentBlock.length > 0) {
			diff_blocks.push(currentBlock);
		  	currentBlock = [];
		}}
		else if (part.startsWith('+') || part.startsWith('-')) {
			currentBlock.push(part);
	  	}
	  	else {
			if (currentBlock.length > 0) {
				diff_blocks.push(currentBlock);
				currentBlock = [];
			}
		}
	}

	if (currentBlock.length > 0) {
		diff_blocks.push(currentBlock);
	}

	const diff_text: string[] = diff_blocks.flatMap((b: string[]) => b);
	const additions: string = diff_text.filter(l => l.startsWith('+')).map(l => l.slice(2)).join("\n");
	const deletions: string = diff_text.filter(l => l.startsWith('-')).map(l => l.slice(2)).join("\n");
	return [additions, deletions];
}

export function find_most_similar_string(text: string, completion: string): [string | undefined, [number, number]] {
	text = simple_cleanup_cr_lf(text);
	let bestRatio: number = 0;
	let bestString: string | undefined = undefined;
	for (const line of text.split('\n')) {
	const s = new Diff.SequenceMatcher(null, line, completion);
	const ratio = s.ratio();
	if (ratio > bestRatio) {
		bestRatio = ratio;
		bestString = line;
	}
	}
	if (bestString) {
		let l_diff: string[] = Diff.ndiff(bestString, completion);
		let additions = l_diff.filter(l => l.startsWith('+')).map(l => l.slice(2)).filter(l => l.replace(/\s+/g, '') !== '');
		let deletions = l_diff.filter(l => l.startsWith('-')).map(l => l.slice(2)).filter(l => l.replace(/\s+/g, '') !== '');
		return [bestString, [additions.length, deletions.length]];
	}
	return [undefined, [0, 0]];
}

export function completion_metrics(text: string, completion: string): [number, [number, number]] {
	text = simple_cleanup_cr_lf(text);
	completion = simple_cleanup_cr_lf(completion);

	if (!completion.includes('\n')) {
		// single line completion
		const [best_s, [add_c, del_c]] = find_most_similar_string(text, completion);
		if (!best_s) {
			return [0, [0, text.replace(/\s+/g, '').length]];
		}
		const best_s_c = (best_s.replace(/\s+/g, '')).length;
		const matched_c: number = best_s_c - del_c;
		const completion_c: number = (completion.replace(/\s+/g, '')).length;
		const human_c = (text.replace(/\s+/g, '')).length - matched_c;
		return [matched_c / completion_c, [matched_c, human_c]];
	}

	let [human_deleted, human_fixed_or_typed] = get_diff_addition_blocks(text, completion);
	human_deleted = human_deleted.replace(/\s+/g, '');
	human_fixed_or_typed = human_fixed_or_typed.replace(/\s+/g, '');

	completion = completion.replace(/\s+/g, '');

	const useful_completion_chars = completion.length - human_deleted.length;
	const human_chars = human_fixed_or_typed.length;

	return [useful_completion_chars / completion.length, [useful_completion_chars, human_chars]];
}

export function completion_metric_pipeline(
	state0: string,
	state1: string,
	completion0: string
) : [number, [number, number]] {
	const [additions, _] = get_diff_addition_blocks(state0, state1);
	let score = completion_metrics(additions, completion0);
	return score;
}
