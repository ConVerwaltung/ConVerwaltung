import type { Event } from './event';
import { normalizedName, type ImportDecision, type RowMatch } from './import-match';
import type { ShapedRow } from './import-mapping';
import { compareByCreation } from './library';
import { nameTokens } from './name-similarity';
import type { Participant } from './participant';
import type { Person } from './person';

/*
	What the review needs on top of the matcher, kept out of the screen so it can be
	measured rather than eyeballed. The matcher itself is untouched: everything here reads
	its output. The grades are a screen-level reading of a score — a bare score is never
	shown, so the word is what the organizer decides on.
*/

export type MatchGrade = 'sicher' | 'aehnlich' | 'schwach' | 'mehrdeutig' | 'ohneVorschlag';

export const gradeWords: Readonly<Record<MatchGrade, string>> = {
	sicher: 'Sicher',
	aehnlich: 'Ähnlich',
	schwach: 'Schwach',
	mehrdeutig: 'Mehrdeutig',
	ohneVorschlag: 'Kein Vorschlag'
};

// Two candidates this close are two the matcher cannot separate — the namesake case, and
// the one where a wrong confirmation silently merges two different people.
const AMBIGUOUS_MARGIN = 0.05;

// Above this a candidate reads as one name spelled two ways; below it, as a different
// name that happens to share a token.
const STRONG_SIMILARITY = 0.8;

/**
 * `Sicher` is tight on purpose: the same name after normalisation **and** no second
 * candidate within 5 points. It is the only grade a bulk act acts on.
 */
export function gradeMatch(match: RowMatch): MatchGrade {
	const [best, second] = match.candidates;
	if (best === undefined) {
		return 'ohneVorschlag';
	}
	if (second !== undefined && best.similarity - second.similarity < AMBIGUOUS_MARGIN) {
		return 'mehrdeutig';
	}
	if (normalizedName(match.personName) === normalizedName(best.person.name)) {
		return 'sicher';
	}
	return best.similarity >= STRONG_SIMILARITY ? 'aehnlich' : 'schwach';
}

export function bestSimilarity(match: RowMatch): number {
	return match.candidates[0]?.similarity ?? 0;
}

export interface NamePart {
	readonly text: string;
	/** True where the other name carries no word like this one — the part to underline. */
	readonly differs: boolean;
}

function wordKey(word: string): string {
	return nameTokens(word).join(' ');
}

// Words are consumed as they are paired, so „Anna Anna Meier“ against „Anna Meier“ marks
// the second Anna rather than both.
function wordCounts(name: string): Map<string, number> {
	const counts = new Map<string, number>();
	for (const word of name.split(/\s+/).filter((part) => part !== '')) {
		const key = wordKey(word);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

/**
 * The words of `name`, each marked by whether `other` carries the same word — read in
 * both directions, so the file name and the proposal each underline their own difference.
 */
export function namePartsAgainst(name: string, other: string): NamePart[] {
	const available = wordCounts(other);
	return name
		.split(/\s+/)
		.filter((word) => word !== '')
		.map((word) => {
			const key = wordKey(word);
			const left = available.get(key) ?? 0;
			if (left === 0) {
				return { text: word, differs: true };
			}
			available.set(key, left - 1);
			return { text: word, differs: false };
		});
}

/** How many Persons the pool holds per normalised name — „3 gleichnamige Personen“. */
export function namesakeIndex(persons: Record<string, Person>): ReadonlyMap<string, number> {
	const counts = new Map<string, number>();
	for (const person of Object.values(persons)) {
		const key = normalizedName(person.name);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

export function namesakeCount(index: ReadonlyMap<string, number>, name: string): number {
	return index.get(normalizedName(name)) ?? 0;
}

export interface PersonProvenance {
	readonly eventCount: number;
	/** The most recently created Veranstaltung this Person takes part in; '' for an orphan. */
	readonly lastEventName: string;
}

/**
 * Where a candidate comes from, indexed once: a row's Beleg asks this of every proposal,
 * and the pool is walked once instead of once per row.
 */
export function provenanceIndex(
	participants: Record<string, Participant>,
	events: Record<string, Event>
): ReadonlyMap<string, PersonProvenance> {
	const eventsByPerson = new Map<string, Event[]>();
	for (const participant of Object.values(participants)) {
		const event = events[participant.event];
		if (event === undefined) {
			continue;
		}
		const attended = eventsByPerson.get(participant.person) ?? [];
		attended.push(event);
		eventsByPerson.set(participant.person, attended);
	}
	const provenance = new Map<string, PersonProvenance>();
	for (const [personId, attended] of eventsByPerson) {
		// UUID v7 ids are timestamp-prefixed, so creation order is the order of the ids.
		const byCreation = [...attended].sort(compareByCreation);
		provenance.set(personId, {
			eventCount: byCreation.length,
			lastEventName: byCreation[byCreation.length - 1].name
		});
	}
	return provenance;
}

export const noProvenance: PersonProvenance = { eventCount: 0, lastEventName: '' };

export const reviewFilters = [
	'alle',
	'offen',
	'ohneVorschlag',
	'mehrdeutig',
	'doppelt',
	'verknuepft',
	'neu'
] as const;

export type ReviewFilter = (typeof reviewFilters)[number];

export const filterWords: Readonly<Record<ReviewFilter, string>> = {
	alle: 'Alle',
	offen: 'Offen',
	ohneVorschlag: 'Ohne Vorschlag',
	mehrdeutig: 'Mehrdeutig',
	doppelt: 'Doppelt in der Datei',
	verknuepft: 'Verknüpft',
	neu: 'Neu'
};

export function matchesReviewFilter(
	filter: ReviewFilter,
	match: RowMatch,
	grade: MatchGrade,
	decision: ImportDecision | undefined
): boolean {
	switch (filter) {
		case 'alle':
			return true;
		case 'offen':
			return decision === undefined;
		case 'ohneVorschlag':
			return grade === 'ohneVorschlag';
		case 'mehrdeutig':
			return grade === 'mehrdeutig';
		case 'doppelt':
			return match.duplicateOfRowNumber !== undefined;
		case 'verknuepft':
			return decision?.kind === 'link';
		case 'neu':
			return decision?.kind === 'new';
	}
}

export interface DecisionTally {
	readonly offen: number;
	readonly neu: number;
	readonly verknuepft: number;
	readonly uebersprungen: number;
}

export function tallyDecisions(
	matches: readonly RowMatch[],
	decisions: ReadonlyMap<number, ImportDecision>
): DecisionTally {
	let offen = 0;
	let neu = 0;
	let verknuepft = 0;
	let uebersprungen = 0;
	for (const match of matches) {
		const decision = decisions.get(match.rowNumber);
		if (decision === undefined) {
			offen += 1;
		} else if (decision.kind === 'new') {
			neu += 1;
		} else if (decision.kind === 'link') {
			verknuepft += 1;
		} else {
			uebersprungen += 1;
		}
	}
	return { offen, neu, verknuepft, uebersprungen };
}

export interface SafeLink {
	readonly rowNumber: number;
	readonly personId: string;
}

/**
 * The rows the fast path acts on: graded `Sicher` and still unanswered. A row the
 * organizer has already decided is never overwritten, which is what keeps the bulk act
 * reversible — and its count is the warning printed on the button.
 */
export function safeLinks(
	matches: readonly RowMatch[],
	decisions: ReadonlyMap<number, ImportDecision>
): SafeLink[] {
	return matches
		.filter((match) => !decisions.has(match.rowNumber) && gradeMatch(match) === 'sicher')
		.map((match) => ({ rowNumber: match.rowNumber, personId: match.candidates[0].person.id }));
}

/** Unanswered rows the matcher proposed nothing for — the other bulk act. */
export function unmatchedRowNumbers(
	matches: readonly RowMatch[],
	decisions: ReadonlyMap<number, ImportDecision>
): number[] {
	return matches
		.filter((match) => !decisions.has(match.rowNumber) && match.candidates.length === 0)
		.map((match) => match.rowNumber);
}

export interface RoleNameCount {
	readonly name: string;
	readonly rows: number;
}

/**
 * How many imported rows carried each Rolle name the Veranstaltung does not define — the
 * Bericht states the reach of the omission, not just the name.
 */
export function countRowsByRoleName(
	rows: readonly ShapedRow[],
	decisions: ReadonlyMap<number, ImportDecision>,
	roleNames: readonly string[]
): RoleNameCount[] {
	const wanted = new Set(roleNames);
	const counts = new Map(roleNames.map((name) => [name, 0]));
	rows.forEach((row, index) => {
		const decision = decisions.get(index + 1);
		if (decision === undefined || decision.kind === 'skip') {
			return;
		}
		for (const roleName of row.roleNames) {
			if (wanted.has(roleName)) {
				counts.set(roleName, (counts.get(roleName) ?? 0) + 1);
			}
		}
	});
	return [...counts].map(([name, hits]) => ({ name, rows: hits }));
}
