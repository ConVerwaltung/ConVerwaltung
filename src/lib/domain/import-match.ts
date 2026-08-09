import type { ShapedRow } from './import-mapping';
import { nameSimilarity } from './name-similarity';
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
}

export type ImportDecision =
	| { readonly kind: 'new' }
	| { readonly kind: 'link'; readonly personId: string };

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

/** Rows without a name name no Person and are skipped at commit, not reviewed. */
export function proposeMatches(
	persons: Record<string, Person>,
	rows: readonly ShapedRow[]
): RowMatch[] {
	const pool = Object.values(persons);
	const matches: RowMatch[] = [];
	rows.forEach((row, index) => {
		if (row.personName === '') {
			return;
		}
		const candidates = rankCandidates(pool, row.personName);
		matches.push({ rowNumber: index + 1, personName: row.personName, candidates });
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
