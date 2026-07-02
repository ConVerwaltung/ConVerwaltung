import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import { createEvent, listEventsByCreation, type Event } from './event';

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
