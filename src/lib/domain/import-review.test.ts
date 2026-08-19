import { describe, expect, it } from 'vitest';
import type { Event } from './event';
import type { ImportDecision, MatchCandidate, RowMatch } from './import-match';
import type { ShapedRow } from './import-mapping';
import {
	countRowsByRoleName,
	gradeMatch,
	matchesReviewFilter,
	namePartsAgainst,
	namesakeCount,
	namesakeIndex,
	provenanceIndex,
	safeLinks,
	tallyDecisions,
	unmatchedRowNumbers
} from './import-review';
import type { Participant } from './participant';
import type { Person } from './person';

function person(id: string, name: string): Person {
	return { id, name };
}

function candidate(named: Person, similarity: number): MatchCandidate {
	return { person: named, similarity };
}

function match(
	rowNumber: number,
	personName: string,
	candidates: MatchCandidate[] = [],
	duplicateOfRowNumber?: number
): RowMatch {
	return { rowNumber, personName, candidates, duplicateOfRowNumber };
}

function decisions(...entries: [number, ImportDecision][]): ReadonlyMap<number, ImportDecision> {
	return new Map(entries);
}

const schmitt = person('p-schmitt', 'Maria Schmitt');
const otherSchmitt = person('p-schmitt-2', 'Maria Schmitt');
const schmidt = person('p-schmidt', 'Maria Schmidt');

describe('gradeMatch', () => {
	it('grades a row without candidates as Kein Vorschlag', () => {
		expect(gradeMatch(match(1, 'Ada Lovelace'))).toBe('ohneVorschlag');
	});

	it('grades the same name with no rival within 5 points as Sicher', () => {
		const graded = gradeMatch(match(1, 'Schmitt, Maria', [candidate(schmitt, 1)]));

		expect(graded).toBe('sicher');
	});

	it('grades two namesakes as Mehrdeutig, so the row stays open', () => {
		const graded = gradeMatch(
			match(1, 'Maria Schmitt', [candidate(schmitt, 1), candidate(otherSchmitt, 1)])
		);

		expect(graded).toBe('mehrdeutig');
	});

	it('grades a near rival as Mehrdeutig even below the same-name rule', () => {
		const graded = gradeMatch(
			match(1, 'Maria Schmit', [candidate(schmitt, 0.92), candidate(schmidt, 0.9)])
		);

		expect(graded).toBe('mehrdeutig');
	});

	it('separates a strong single candidate from a weak one', () => {
		expect(gradeMatch(match(1, 'Maria Schmit', [candidate(schmitt, 0.92)]))).toBe('aehnlich');
		expect(gradeMatch(match(2, 'M. Schmitt', [candidate(schmitt, 0.7)]))).toBe('schwach');
	});
});

describe('namePartsAgainst', () => {
	it('marks only the word the other name does not carry', () => {
		expect(namePartsAgainst('M. Schmitt', 'Maria Schmitt')).toEqual([
			{ text: 'M.', differs: true },
			{ text: 'Schmitt', differs: false }
		]);
	});

	it('reads a word the matcher considers equal as equal', () => {
		expect(namePartsAgainst('Thomas Mueller', 'Thomas Müller')).toEqual([
			{ text: 'Thomas', differs: false },
			{ text: 'Mueller', differs: false }
		]);
	});

	it('ignores word order, as the matcher does', () => {
		const parts = namePartsAgainst('Schmitt, Maria', 'Maria Schmitt');

		expect(parts.every((part) => !part.differs)).toBe(true);
	});

	it('consumes a paired word, so a repetition is marked', () => {
		expect(namePartsAgainst('Anna Anna Meier', 'Anna Meier')).toEqual([
			{ text: 'Anna', differs: false },
			{ text: 'Anna', differs: true },
			{ text: 'Meier', differs: false }
		]);
	});
});

describe('namesakeIndex', () => {
	it('counts the Persons of the pool sharing one normalised name', () => {
		const index = namesakeIndex({
			[schmitt.id]: schmitt,
			[otherSchmitt.id]: otherSchmitt,
			[schmidt.id]: schmidt
		});

		expect(namesakeCount(index, 'Schmitt, Maria')).toBe(2);
		expect(namesakeCount(index, 'Ada Lovelace')).toBe(0);
	});
});

describe('provenanceIndex', () => {
	const earlier: Event = { id: 'e-1', name: 'Mövennest' };
	const later: Event = { id: 'e-2', name: 'Krähenmoor' };

	function participant(id: string, eventId: string, personId: string): Participant {
		return { id, event: eventId, person: personId, roles: [] };
	}

	it('counts the Veranstaltungen of a Person and names the most recent one', () => {
		const index = provenanceIndex(
			{
				'tn-1': participant('tn-1', earlier.id, schmitt.id),
				'tn-2': participant('tn-2', later.id, schmitt.id)
			},
			{ [earlier.id]: earlier, [later.id]: later }
		);

		expect(index.get(schmitt.id)).toEqual({ eventCount: 2, lastEventName: 'Krähenmoor' });
	});

	it('knows nothing of a Person without Teilnahmen', () => {
		const index = provenanceIndex({}, { [earlier.id]: earlier });

		expect(index.get(schmitt.id)).toBeUndefined();
	});
});

describe('matchesReviewFilter', () => {
	const open = match(1, 'Maria Schmitt', [candidate(schmitt, 1)]);
	const duplicate = match(2, 'Maria Schmitt', [candidate(schmitt, 1)], 1);
	const withoutCandidate = match(3, 'Ada Lovelace');

	it('keeps every row under Alle', () => {
		expect(matchesReviewFilter('alle', withoutCandidate, 'ohneVorschlag', undefined)).toBe(true);
	});

	it('reads an absent decision as offen', () => {
		expect(matchesReviewFilter('offen', open, 'sicher', undefined)).toBe(true);
		expect(matchesReviewFilter('offen', open, 'sicher', { kind: 'skip' })).toBe(false);
	});

	it('selects by grade, by duplicate flag and by decision', () => {
		expect(matchesReviewFilter('ohneVorschlag', withoutCandidate, 'ohneVorschlag', undefined)).toBe(
			true
		);
		expect(matchesReviewFilter('doppelt', duplicate, 'sicher', undefined)).toBe(true);
		expect(matchesReviewFilter('doppelt', open, 'sicher', undefined)).toBe(false);
		expect(
			matchesReviewFilter('verknuepft', open, 'sicher', { kind: 'link', personId: schmitt.id })
		).toBe(true);
		expect(matchesReviewFilter('neu', withoutCandidate, 'ohneVorschlag', { kind: 'new' })).toBe(
			true
		);
	});
});

describe('tallyDecisions', () => {
	it('counts the four states the foot states', () => {
		const matches = [match(1, 'A'), match(2, 'B'), match(3, 'C'), match(4, 'D')];
		const tally = tallyDecisions(
			matches,
			decisions(
				[2, { kind: 'new' }],
				[3, { kind: 'link', personId: schmitt.id }],
				[4, { kind: 'skip' }]
			)
		);

		expect(tally).toEqual({ offen: 1, neu: 1, verknuepft: 1, uebersprungen: 1 });
	});
});

describe('the bulk acts', () => {
	const sicher = match(1, 'Schmitt, Maria', [candidate(schmitt, 1)]);
	const ambiguous = match(2, 'Maria Schmitt', [candidate(schmitt, 1), candidate(otherSchmitt, 1)]);
	const unmatched = match(3, 'Ada Lovelace');

	it('takes the Sicher rows and their candidate', () => {
		const links = safeLinks([sicher, ambiguous, unmatched], decisions());

		expect(links).toEqual([{ rowNumber: 1, personId: schmitt.id }]);
	});

	it('leaves a row the organizer already answered alone', () => {
		const links = safeLinks([sicher], decisions([1, { kind: 'skip' }]));

		expect(links).toEqual([]);
	});

	it('takes the rows without a candidate, and only those', () => {
		expect(unmatchedRowNumbers([sicher, ambiguous, unmatched], decisions())).toEqual([3]);
		expect(unmatchedRowNumbers([unmatched], decisions([3, { kind: 'new' }]))).toEqual([]);
	});
});

describe('countRowsByRoleName', () => {
	function row(...roleNames: string[]): ShapedRow {
		return { personName: 'X', personValues: {}, participantValues: {}, roleNames };
	}

	it('counts the imported rows carrying an unknown Rolle name', () => {
		const rows = [row('Küche'), row('Küche', 'SL'), row('Küche')];
		const counts = countRowsByRoleName(
			rows,
			decisions([1, { kind: 'new' }], [2, { kind: 'link', personId: schmitt.id }]),
			['Küche']
		);

		expect(counts).toEqual([{ name: 'Küche', rows: 2 }]);
	});

	it('counts no skipped and no open row, which write nothing', () => {
		const counts = countRowsByRoleName([row('Küche'), row('Küche')], decisions([1, { kind: 'skip' }]), [
			'Küche'
		]);

		expect(counts).toEqual([{ name: 'Küche', rows: 0 }]);
	});
});
