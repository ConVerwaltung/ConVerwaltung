import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import { createEmptyLibrary, type Library, type RecordKey } from './library';
import { collectErasureDeletions, createPerson, listPersonsByName, type Person } from './person';

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

describe('collectErasureDeletions', () => {
	// A Library where Ada takes part in two Events with a Role, a Note and Custom
	// Field values at both levels; Grace shares the summer Event, Kurt is an
	// orphan Person. Ada is the one to be erased.
	function libraryWithAdaEverywhere(): Library {
		const library = createEmptyLibrary();
		library.events['ev1'] = { id: 'ev1', name: 'Sommerfest' };
		library.events['ev2'] = { id: 'ev2', name: 'Herbstfest' };
		library.roles['ro1'] = { id: 'ro1', event: 'ev1', name: 'Gast' };
		library.customFields['cf1'] = { id: 'cf1', level: 'person', type: 'text', name: 'E-Mail' };
		library.customFields['cf2'] = {
			id: 'cf2',
			level: 'participant',
			type: 'text',
			event: 'ev1',
			name: 'Zimmer'
		};
		library.persons['ada'] = {
			id: 'ada',
			name: 'Ada Lovelace',
			note: 'Vegetarierin',
			customValues: { cf1: 'ada@example.org' }
		};
		library.persons['grace'] = { id: 'grace', name: 'Grace Hopper' };
		library.persons['kurt'] = { id: 'kurt', name: 'Kurt Gödel' };
		library.participants['pa1'] = {
			id: 'pa1',
			event: 'ev1',
			person: 'ada',
			roles: ['ro1'],
			note: 'Reist früher ab',
			customValues: { cf2: '204' }
		};
		library.participants['pa2'] = { id: 'pa2', event: 'ev2', person: 'ada', roles: [] };
		library.participants['pa3'] = { id: 'pa3', event: 'ev1', person: 'grace', roles: ['ro1'] };
		return library;
	}

	function applyDeletions(library: Library, deletions: RecordKey[]): void {
		for (const { section, id } of deletions) {
			delete library[section][id];
		}
	}

	it('removes the Person and every Participant of theirs across all Events', () => {
		const library = libraryWithAdaEverywhere();

		applyDeletions(library, collectErasureDeletions(library.participants, 'ada'));

		expect(Object.keys(library.persons).sort()).toEqual(['grace', 'kurt']);
		expect(Object.keys(library.participants)).toEqual(['pa3']);
	});

	it('leaves Events, Roles, Custom Field definitions and other Persons untouched', () => {
		const library = libraryWithAdaEverywhere();

		const deletions = collectErasureDeletions(library.participants, 'ada');

		expect(deletions.every((key) => key.section === 'persons' || key.section === 'participants')).toBe(
			true
		);

		applyDeletions(library, deletions);
		expect(Object.keys(library.events).sort()).toEqual(['ev1', 'ev2']);
		expect(Object.keys(library.roles)).toEqual(['ro1']);
		expect(Object.keys(library.customFields).sort()).toEqual(['cf1', 'cf2']);
	});

	it('leaves no trace of the Person, including Notes and Custom Field values', () => {
		const library = libraryWithAdaEverywhere();

		applyDeletions(library, collectErasureDeletions(library.participants, 'ada'));

		const serialized = JSON.stringify(library);
		expect(serialized).not.toContain('ada');
		expect(serialized).not.toContain('Ada Lovelace');
		expect(serialized).not.toContain('Vegetarierin');
		expect(serialized).not.toContain('Reist früher ab');
	});

	it('writes no tombstone: only deletions, no records survive as markers (ADR-0007)', () => {
		const library = libraryWithAdaEverywhere();
		const expected = JSON.parse(JSON.stringify(library)) as Library;

		applyDeletions(library, collectErasureDeletions(library.participants, 'ada'));

		// Exactly the erased records disappeared; nothing was added or rewritten.
		delete expected.persons['ada'];
		delete expected.participants['pa1'];
		delete expected.participants['pa2'];
		expect(library).toEqual(expected);
	});

	it('erases an orphan Person as the single deletion', () => {
		const library = libraryWithAdaEverywhere();

		expect(collectErasureDeletions(library.participants, 'kurt')).toEqual([
			{ section: 'persons', id: 'kurt' }
		]);
	});
});
