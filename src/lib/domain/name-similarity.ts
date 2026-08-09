const LIGATURE_EXPANSIONS: Record<string, string> = {
	ä: 'ae',
	ö: 'oe',
	ü: 'ue',
	ß: 'ss'
};

const COMBINING_MARKS = /[̀-ͯ]/g;

// Expanding the ligatures has to precede stripping the diacritics: stripped
// first, "Müller" would collapse to "muller" and no longer meet "Mueller".
export function nameTokens(name: string): string[] {
	const composed = name.normalize('NFC').toLowerCase();
	const expanded = composed.replace(/[äöüß]/g, (character) => LIGATURE_EXPANSIONS[character]);
	const stripped = expanded.normalize('NFD').replace(COMBINING_MARKS, '');
	const separated = stripped.replace(/[^\p{L}\p{N}]+/gu, ' ');
	return separated.split(' ').filter((token) => token !== '');
}

function editDistance(a: string, b: string): number {
	let previousRow = [...Array(b.length + 1).keys()];
	for (let rowIndex = 1; rowIndex <= a.length; rowIndex++) {
		const currentRow = [rowIndex];
		for (let columnIndex = 1; columnIndex <= b.length; columnIndex++) {
			const substitutionCost = a[rowIndex - 1] === b[columnIndex - 1] ? 0 : 1;
			const substitution = previousRow[columnIndex - 1] + substitutionCost;
			const insertion = currentRow[columnIndex - 1] + 1;
			const deletion = previousRow[columnIndex] + 1;
			currentRow.push(Math.min(substitution, insertion, deletion));
		}
		previousRow = currentRow;
	}
	return previousRow[b.length];
}

function tokenSimilarity(a: string, b: string): number {
	const longest = Math.max(a.length, b.length);
	if (longest === 0) {
		return 0;
	}
	const distance = editDistance(a, b);
	return 1 - distance / longest;
}

// Below this two tokens are different names rather than variants of one, and
// pairing them would consume a token another pair needs.
const MIN_PAIR_SIMILARITY = 0.5;

interface TokenPair {
	readonly index: number;
	readonly otherIndex: number;
	readonly similarity: number;
}

function candidatePairs(tokens: readonly string[], others: readonly string[]): TokenPair[] {
	const pairs: TokenPair[] = [];
	tokens.forEach((token, index) => {
		others.forEach((other, otherIndex) => {
			const similarity = tokenSimilarity(token, other);
			if (similarity >= MIN_PAIR_SIMILARITY) {
				pairs.push({ index, otherIndex, similarity });
			}
		});
	});
	return pairs;
}

// Pairs are taken best-first across both names rather than in reading order, so
// token order carries no weight and the score is the same in either direction.
function pairedTokenScore(tokens: readonly string[], others: readonly string[]): number {
	const pairs = candidatePairs(tokens, others);
	pairs.sort((a, b) => b.similarity - a.similarity);
	const pairedIndices = new Set<number>();
	const pairedOtherIndices = new Set<number>();
	let score = 0;
	for (const pair of pairs) {
		if (pairedIndices.has(pair.index) || pairedOtherIndices.has(pair.otherIndex)) {
			continue;
		}
		pairedIndices.add(pair.index);
		pairedOtherIndices.add(pair.otherIndex);
		score += pair.similarity;
	}
	return score;
}

/** 1 for names that normalize alike, 0 for nothing in common. */
export function nameSimilarity(a: string, b: string): number {
	const tokensA = nameTokens(a);
	const tokensB = nameTokens(b);
	if (tokensA.length === 0 || tokensB.length === 0) {
		return 0;
	}
	const score = pairedTokenScore(tokensA, tokensB);
	return (2 * score) / (tokensA.length + tokensB.length);
}
