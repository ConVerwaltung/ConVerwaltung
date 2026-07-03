import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import { createPerson, listPersonsByName, type Person } from './person';

describe('createPerson', () => {
	it('creates a Person with the given name and a UUID v7 id', () => {
		const person = createPerson('Ada Lovelace');

		expect(person.name).toBe('Ada Lovelace');
		expect(uuidValidate(person.id)).toBe(true);
		expect(uuidVersion(person.id)).toBe(7);
	});

	it('trims surrounding whitespace from the name', () => {
		expect(createPerson('  Ada Lovelace  ').name).toBe('Ada Lovelace');
	});

	it('rejects a blank name', () => {
		expect(() => createPerson('')).toThrow();
		expect(() => createPerson('   ')).toThrow();
	});

	it('gives every Person a distinct id', () => {
		const first = createPerson('Ada Lovelace');
		const second = createPerson('Ada Lovelace');

		expect(first.id).not.toBe(second.id);
	});
});

describe('listPersonsByName', () => {
	it('is empty for an empty Person pool', () => {
		expect(listPersonsByName({})).toEqual([]);
	});

	it('sorts Persons alphabetically by name', () => {
		const grace: Person = { id: 'grace', name: 'Grace Hopper' };
		const ada: Person = { id: 'ada', name: 'Ada Lovelace' };
		const kurt: Person = { id: 'kurt', name: 'Kurt Gödel' };

		const persons = listPersonsByName({ [grace.id]: grace, [ada.id]: ada, [kurt.id]: kurt });

		expect(persons).toEqual([ada, grace, kurt]);
	});
});
