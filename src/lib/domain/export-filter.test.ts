import { describe, expect, it } from 'vitest';
import type { CustomFieldDefinition } from './custom-field';
import {
	matchesFilter,
	normalizeFilter,
	type FilterCondition,
	type FilteredRecord
} from './export-filter';
import type { Participant } from './participant';
import type { Person } from './person';

// One Person-level text and number field, and Participant-level fields of the
// remaining types. Ada holds a Role and a value in every field, Grace neither.
const definitions: Record<string, CustomFieldDefinition> = {
	club: { id: 'club', level: 'person', type: 'text', name: 'Verein' },
	age: { id: 'age', level: 'person', type: 'number', name: 'Alter' },
	paid: { id: 'paid', level: 'participant', event: 'ev1', type: 'boolean', name: 'Bezahlt' },
	arrival: { id: 'arrival', level: 'participant', event: 'ev1', type: 'date', name: 'Anreise' },
	meal: {
		id: 'meal',
		level: 'participant',
		event: 'ev1',
		type: 'select',
		name: 'Essen',
		selectOptions: ['Fleisch', 'Vegan']
	}
};

const ada: Person = {
	id: 'ada',
	name: 'Ada Lovelace',
	customValues: { club: 'SV Nord', age: '42' }
};
const grace: Person = { id: 'grace', name: 'Grace Hopper' };

const adaParticipant: Participant = {
	id: 'pa1',
	event: 'ev1',
	person: 'ada',
	roles: ['guest', 'helper'],
	customValues: { paid: 'true', arrival: '2026-08-01', meal: 'Vegan' }
};
const graceParticipant: Participant = { id: 'pa2', event: 'ev1', person: 'grace', roles: [] };

const adaRecord: FilteredRecord = { person: ada, participant: adaParticipant };
const graceRecord: FilteredRecord = { person: grace, participant: graceParticipant };

function matches(condition: FilterCondition, record: FilteredRecord): boolean {
	return matchesFilter([condition], definitions, record);
}

describe('normalizeFilter', () => {
	it('trims the comparison value', () => {
		const conditions: FilterCondition[] = [
			{ kind: 'field', definitionId: 'club', test: { kind: 'equals', value: '  SV Nord ' } }
		];

		expect(normalizeFilter(conditions)).toEqual([
			{ kind: 'field', definitionId: 'club', test: { kind: 'equals', value: 'SV Nord' } }
		]);
	});

	it('rejects a blank comparison value', () => {
		const conditions: FilterCondition[] = [
			{ kind: 'field', definitionId: 'club', test: { kind: 'equals', value: '  ' } }
		];

		expect(() => normalizeFilter(conditions)).toThrow();
	});

	it('passes Role conditions and emptiness tests through', () => {
		const conditions: FilterCondition[] = [
			{ kind: 'role', roleId: 'guest', holds: false },
			{ kind: 'field', definitionId: 'club', test: { kind: 'empty' } }
		];

		expect(normalizeFilter(conditions)).toEqual(conditions);
	});
});

describe('matchesFilter with a Role condition', () => {
	it('matches the Participants holding the Role', () => {
		const condition: FilterCondition = { kind: 'role', roleId: 'guest', holds: true };

		expect(matches(condition, adaRecord)).toBe(true);
		expect(matches(condition, graceRecord)).toBe(false);
	});

	it('matches the Participants lacking the Role', () => {
		const condition: FilterCondition = { kind: 'role', roleId: 'guest', holds: false };

		expect(matches(condition, adaRecord)).toBe(false);
		expect(matches(condition, graceRecord)).toBe(true);
	});

	it('treats a Person-level record as holding no Role', () => {
		const record: FilteredRecord = { person: ada };

		expect(matches({ kind: 'role', roleId: 'guest', holds: true }, record)).toBe(false);
		expect(matches({ kind: 'role', roleId: 'guest', holds: false }, record)).toBe(true);
	});
});

describe('matchesFilter with a Custom Field condition', () => {
	it('compares text without regard to case', () => {
		const condition: FilterCondition = {
			kind: 'field',
			definitionId: 'club',
			test: { kind: 'equals', value: 'sv nord' }
		};

		expect(matches(condition, adaRecord)).toBe(true);
		expect(matches(condition, graceRecord)).toBe(false);
	});

	it('compares numbers by value, not by notation', () => {
		const condition: FilterCondition = {
			kind: 'field',
			definitionId: 'age',
			test: { kind: 'equals', value: '42.0' }
		};

		expect(matches(condition, adaRecord)).toBe(true);
	});

	it('does not read an empty number as zero', () => {
		const condition: FilterCondition = {
			kind: 'field',
			definitionId: 'age',
			test: { kind: 'equals', value: '0' }
		};

		expect(matches(condition, graceRecord)).toBe(false);
	});

	it('compares booleans as true and false', () => {
		const isTrue: FilterCondition = {
			kind: 'field',
			definitionId: 'paid',
			test: { kind: 'equals', value: 'true' }
		};
		const isFalse: FilterCondition = {
			kind: 'field',
			definitionId: 'paid',
			test: { kind: 'equals', value: 'false' }
		};

		expect(matches(isTrue, adaRecord)).toBe(true);
		expect(matches(isFalse, adaRecord)).toBe(false);
		expect(matches(isFalse, graceRecord)).toBe(false);
	});

	it('compares dates by calendar day', () => {
		const condition: FilterCondition = {
			kind: 'field',
			definitionId: 'arrival',
			test: { kind: 'equals', value: '2026-08-01' }
		};
		const otherDay: FilterCondition = {
			kind: 'field',
			definitionId: 'arrival',
			test: { kind: 'equals', value: '2026-08-02' }
		};

		expect(matches(condition, adaRecord)).toBe(true);
		expect(matches(otherDay, adaRecord)).toBe(false);
	});

	it('compares a single-select against its options', () => {
		const vegan: FilterCondition = {
			kind: 'field',
			definitionId: 'meal',
			test: { kind: 'equals', value: 'Vegan' }
		};
		const meat: FilterCondition = {
			kind: 'field',
			definitionId: 'meal',
			test: { kind: 'equals', value: 'Fleisch' }
		};

		expect(matches(vegan, adaRecord)).toBe(true);
		expect(matches(meat, adaRecord)).toBe(false);
	});

	it('tests emptiness on a Person-level field', () => {
		const empty: FilterCondition = {
			kind: 'field',
			definitionId: 'club',
			test: { kind: 'empty' }
		};
		const notEmpty: FilterCondition = {
			kind: 'field',
			definitionId: 'club',
			test: { kind: 'notEmpty' }
		};

		expect(matches(empty, adaRecord)).toBe(false);
		expect(matches(notEmpty, adaRecord)).toBe(true);
		expect(matches(empty, graceRecord)).toBe(true);
		expect(matches(notEmpty, graceRecord)).toBe(false);
	});

	it('tests emptiness on a Participant-level field', () => {
		const empty: FilterCondition = {
			kind: 'field',
			definitionId: 'meal',
			test: { kind: 'empty' }
		};

		expect(matches(empty, adaRecord)).toBe(false);
		expect(matches(empty, graceRecord)).toBe(true);
	});

	it('leaves a Participant-level field empty on a Person-level record', () => {
		const record: FilteredRecord = { person: ada };
		const empty: FilterCondition = {
			kind: 'field',
			definitionId: 'paid',
			test: { kind: 'empty' }
		};

		expect(matches(empty, record)).toBe(true);
	});

	it('reads a Custom Field removed since as empty everywhere', () => {
		const empty: FilterCondition = { kind: 'field', definitionId: 'gone', test: { kind: 'empty' } };
		const equals: FilterCondition = {
			kind: 'field',
			definitionId: 'gone',
			test: { kind: 'equals', value: 'irgendwas' }
		};

		expect(matches(empty, adaRecord)).toBe(true);
		expect(matches(equals, adaRecord)).toBe(false);
	});
});

describe('matchesFilter with several conditions', () => {
	it('demands that every condition holds', () => {
		const conditions: FilterCondition[] = [
			{ kind: 'role', roleId: 'guest', holds: true },
			{ kind: 'field', definitionId: 'club', test: { kind: 'notEmpty' } },
			{ kind: 'field', definitionId: 'meal', test: { kind: 'equals', value: 'Vegan' } }
		];

		expect(matchesFilter(conditions, definitions, adaRecord)).toBe(true);
		expect(matchesFilter(conditions, definitions, graceRecord)).toBe(false);
	});

	it('fails as soon as one condition does not hold', () => {
		const conditions: FilterCondition[] = [
			{ kind: 'role', roleId: 'guest', holds: true },
			{ kind: 'field', definitionId: 'meal', test: { kind: 'equals', value: 'Fleisch' } }
		];

		expect(matchesFilter(conditions, definitions, adaRecord)).toBe(false);
	});

	it('matches every record without conditions', () => {
		expect(matchesFilter([], definitions, adaRecord)).toBe(true);
		expect(matchesFilter([], definitions, graceRecord)).toBe(true);
	});
});
