import { describe, expect, it } from 'vitest';
import { proposeMatches, undecidedRowNumbers, type ImportDecision } from './import-match';
import type { ShapedRow } from './import-mapping';
import type { Person } from './person';

function person(id: string, name: string): Person {
	return { id, name };
}

function pool(...persons: Person[]): Record<string, Person> {
	return Object.fromEntries(persons.map((entry) => [entry.id, entry]));
}

function row(personName: string): ShapedRow {
	return { personName, personValues: {}, participantValues: {}, roleNames: [] };
}

const mueller = person('p-mueller', 'Thomas Müller');
const schmidt = person('p-schmidt', 'Anna Maria Schmidt');
const hopper = person('p-hopper', 'Grace Hopper');

describe('proposeMatches', () => {
	it('proposes the Person whose name only differs in transliteration', () => {
		const matches = proposeMatches(pool(mueller, hopper), [row('Thomas Mueller')]);

		expect(matches).toHaveLength(1);
		expect(matches[0].rowNumber).toBe(1);
		expect(matches[0].personName).toBe('Thomas Mueller');
		expect(matches[0].candidates.map((candidate) => candidate.person.id)).toEqual([mueller.id]);
		expect(matches[0].candidates[0].similarity).toBe(1);
	});

	it('proposes the Person whose name tokens are reordered', () => {
		const matches = proposeMatches(pool(schmidt, hopper), [row('Schmidt, Anna Maria')]);

		expect(matches[0].candidates.map((candidate) => candidate.person.id)).toEqual([schmidt.id]);
	});

	it('ranks candidates by similarity, most similar first', () => {
		const other = person('p-schmitt', 'Anna Schmitt');
		const matches = proposeMatches(pool(other, schmidt), [row('Anna Maria Schmidt')]);

		expect(matches[0].candidates.map((candidate) => candidate.person.id)).toEqual([
			schmidt.id,
			other.id
		]);
	});

	it('proposes nothing when no existing Person is plausible', () => {
		const matches = proposeMatches(pool(hopper), [row('Thomas Mueller')]);

		expect(matches[0].candidates).toEqual([]);
	});

	it('proposes nothing against an empty Person pool', () => {
		const matches = proposeMatches({}, [row('Thomas Mueller')]);

		expect(matches[0].candidates).toEqual([]);
	});

	it('limits the candidates per row', () => {
		const namesakes = Array.from({ length: 8 }, (_, index) =>
			person(`p-${index}`, `Anna Schmid${index}`)
		);
		const matches = proposeMatches(pool(...namesakes), [row('Anna Schmidt')]);

		expect(matches[0].candidates).toHaveLength(5);
	});

	it('leaves rows without a name out of the review, keeping row numbers', () => {
		const matches = proposeMatches(pool(mueller), [row(''), row('Thomas Mueller'), row('')]);

		expect(matches.map((match) => match.rowNumber)).toEqual([2]);
	});
});

describe('undecidedRowNumbers', () => {
	it('reports the reviewed rows without a decision', () => {
		const matches = proposeMatches(pool(mueller), [row('Thomas Mueller'), row('Grace Hopper')]);
		const decisions = new Map<number, ImportDecision>([[2, { kind: 'new' }]]);

		expect(undecidedRowNumbers(matches, decisions)).toEqual([1]);
	});

	it('reports nothing once every reviewed row is decided', () => {
		const matches = proposeMatches(pool(mueller), [row('Thomas Mueller')]);
		const decisions = new Map<number, ImportDecision>([[1, { kind: 'link', personId: mueller.id }]]);

		expect(undecidedRowNumbers(matches, decisions)).toEqual([]);
	});
});
