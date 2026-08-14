import type { ShapedRow } from './import-mapping';
import { nameSimilarity, nameTokens } from './name-similarity';
import type { Person } from './person';

// Deliberately loose: a missed candidate cannot be recovered from the review,
// while a wrong one is one rejection away. Both stay the organizer's call.
const CANDIDATE_THRESHOLD = 0.6;
const CANDIDATE_LIMIT = 5;

export interface MatchCandidate {
	readonly person: Person;
	readonly similarity: number;
}

export interface RowMatch {
	/** Position among the file's data rows, counted from 1. */
	readonly rowNumber: number;
	readonly personName: string;
	/** Most similar first; empty when no existing Person is plausible. */
	readonly candidates: readonly MatchCandidate[];
	/** The earlier row naming the same Person, if the file repeats the name. */
	readonly duplicateOfRowNumber?: number;
}

// `skip` is a decision like the others — a duplicate row or a cancelled booking
// is answered rather than left open. The absence of a decision stays the open
// row, which is why there is no `open` here.
export type ImportDecision =
	| { readonly kind: 'new' }
	| { readonly kind: 'link'; readonly personId: string }
	| { readonly kind: 'skip' };

/** Names that differ only in spelling, transliteration or token order share this key. */
export function normalizedName(name: string): string {
	return nameTokens(name).sort().join(' ');
}

function rankCandidates(pool: readonly Person[], personName: string): MatchCandidate[] {
	const scored = pool.map((person) => ({
		person,
		similarity: nameSimilarity(personName, person.name)
	}));
	return scored
		.filter((candidate) => candidate.similarity >= CANDIDATE_THRESHOLD)
		.sort((a, b) => b.similarity - a.similarity || a.person.name.localeCompare(b.person.name))
		.slice(0, CANDIDATE_LIMIT);
}

// A repeated name is no error: only the later row is flagged, and it names the
// row it repeats so the review can say where the name already stands.
function duplicateOfRowNumber(
	firstRowByName: Map<string, number>,
	personName: string,
	rowNumber: number
): number | undefined {
	const key = normalizedName(personName);
	const firstRowNumber = firstRowByName.get(key);
	if (firstRowNumber === undefined) {
		firstRowByName.set(key, rowNumber);
		return undefined;
	}
	return firstRowNumber;
}

/** Rows without a name name no Person and are skipped at commit, not reviewed. */
export function proposeMatches(
	persons: Record<string, Person>,
	rows: readonly ShapedRow[]
): RowMatch[] {
	const pool = Object.values(persons);
	const firstRowByName = new Map<string, number>();
	const matches: RowMatch[] = [];
	rows.forEach((row, index) => {
		if (row.personName === '') {
			return;
		}
		const rowNumber = index + 1;
		matches.push({
			rowNumber,
			personName: row.personName,
			candidates: rankCandidates(pool, row.personName),
			duplicateOfRowNumber: duplicateOfRowNumber(firstRowByName, row.personName, rowNumber)
		});
	});
	return matches;
}

export function undecidedRowNumbers(
	matches: readonly RowMatch[],
	decisions: ReadonlyMap<number, ImportDecision>
): number[] {
	return matches
		.filter((match) => !decisions.has(match.rowNumber))
		.map((match) => match.rowNumber);
}
