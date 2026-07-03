import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import {
	collectEventScopedDeletions,
	createEvent,
	listEventsByCreation,
	renameEvent,
	type Event
} from './event';
import { createEmptyLibrary, type Library, type RecordKey } from './library';

describe('createEvent', () => {
	it('creates an Event with the given name and a UUID v7 id', () => {
		const event = createEvent('Sommerfest 2026');

		expect(event.name).toBe('Sommerfest 2026');
		expect(uuidValidate(event.id)).toBe(true);
		expect(uuidVersion(event.id)).toBe(7);
	});

	it('trims surrounding whitespace from the name', () => {
		expect(createEvent('  Sommerfest 2026  ').name).toBe('Sommerfest 2026');
	});

	it('rejects a blank name', () => {
		expect(() => createEvent('')).toThrow();
		expect(() => createEvent('   ')).toThrow();
	});

	it('gives every Event a distinct id', () => {
		const first = createEvent('Sommerfest 2026');
		const second = createEvent('Sommerfest 2026');

		expect(first.id).not.toBe(second.id);
	});
});

describe('listEventsByCreation', () => {
	it('is empty for no Events', () => {
		expect(listEventsByCreation({})).toEqual([]);
	});

	it('sorts Events by id, i.e. creation order for UUID v7 keys', () => {
		const older: Event = { id: '018f0000-0000-7000-8000-000000000000', name: 'Frühjahr' };
		const newer: Event = { id: '01900000-0000-7000-8000-000000000000', name: 'Herbst' };

		const events = listEventsByCreation({ [newer.id]: newer, [older.id]: older });

		expect(events).toEqual([older, newer]);
	});
});

describe('renameEvent', () => {
	it('changes the name and keeps the id', () => {
		const event = createEvent('Sommerfest 2026');

		const renamed = renameEvent(event, 'Herbstfest 2026');

		expect(renamed).toEqual({ id: event.id, name: 'Herbstfest 2026' });
	});

	it('trims surrounding whitespace from the new name', () => {
		expect(renameEvent(createEvent('Alt'), '  Neu  ').name).toBe('Neu');
	});

	it('rejects a blank new name', () => {
		const event = createEvent('Sommerfest 2026');

		expect(() => renameEvent(event, '')).toThrow();
		expect(() => renameEvent(event, '   ')).toThrow();
	});

	it('does not mutate the given Event', () => {
		const event = createEvent('Alt');

		renameEvent(event, 'Neu');

		expect(event.name).toBe('Alt');
	});
});

describe('collectEventScopedDeletions', () => {
	// A Library with two Events, three Persons and three Participants: Ada takes part in
	// both Events, Grace only in the summer one, and Kurt is an orphan Person.
	function libraryWithTwoEvents(): {
		library: Library;
		summerFest: Event;
		autumnFest: Event;
	} {
		const library = createEmptyLibrary();
		const summerFest = createEvent('Sommerfest');
		const autumnFest = createEvent('Herbstfest');
		library.events[summerFest.id] = summerFest;
		library.events[autumnFest.id] = autumnFest;
		library.persons['ada'] = { id: 'ada' };
		library.persons['grace'] = { id: 'grace' };
		library.persons['kurt'] = { id: 'kurt' };
		library.participants['pa1'] = { id: 'pa1', event: summerFest.id };
		library.participants['pa2'] = { id: 'pa2', event: autumnFest.id };
		library.participants['pa3'] = { id: 'pa3', event: summerFest.id };
		return { library, summerFest, autumnFest };
	}

	function applyDeletions(library: Library, deletions: RecordKey[]): void {
		for (const { section, id } of deletions) {
			delete library[section][id];
		}
	}

	it('removes the Event and exactly its own Participants', () => {
		const { library, summerFest, autumnFest } = libraryWithTwoEvents();

		applyDeletions(library, collectEventScopedDeletions(library, summerFest.id));

		expect(Object.keys(library.events)).toEqual([autumnFest.id]);
		expect(Object.keys(library.participants)).toEqual(['pa2']);
	});

	it('leaves every Person untouched, including resulting orphans (ADR-0005)', () => {
		const { library, summerFest } = libraryWithTwoEvents();

		const deletions = collectEventScopedDeletions(library, summerFest.id);

		expect(deletions.every((key) => key.section !== 'persons')).toBe(true);

		applyDeletions(library, deletions);
		// Grace and Kurt now have zero Participants — orphan Persons are retained.
		expect(Object.keys(library.persons).sort()).toEqual(['ada', 'grace', 'kurt']);
	});
});
