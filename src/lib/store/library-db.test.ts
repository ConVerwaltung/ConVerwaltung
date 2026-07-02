import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createEmptyLibrary } from '$lib/domain/library';
import { createEvent } from '$lib/domain/event';
import { newRecordId } from '$lib/domain/ids';
import { loadLibrary, openLibraryDb, putRecord } from './library-db';

// Unique DB name per test so fake-indexeddb state does not leak between tests.
let dbCounter = 0;
function uniqueDbName(): string {
	return `amts-library-test-${dbCounter++}`;
}

describe('library store', () => {
	it('loads an empty store as a valid empty Library', async () => {
		const db = await openLibraryDb(uniqueDbName());

		const library = await loadLibrary(db);

		expect(library).toEqual(createEmptyLibrary());
		db.close();
	});

	it('round-trips: written records reload as an identical Library', async () => {
		const dbName = uniqueDbName();
		const event = createEvent('Sommerfest 2026');
		const person = { id: newRecordId(), name: 'Ada Lovelace' };

		const db = await openLibraryDb(dbName);
		await putRecord(db, 'events', event);
		await putRecord(db, 'persons', person);
		db.close();

		const reopened = await openLibraryDb(dbName);
		const library = await loadLibrary(reopened);

		const expected = createEmptyLibrary();
		expected.events[event.id] = event;
		expected.persons[person.id] = person;
		expect(library).toEqual(expected);
		reopened.close();
	});

	it('persists the latest write for a record id', async () => {
		const dbName = uniqueDbName();
		const id = newRecordId();

		const original = { id, name: 'Alt' };
		const updated = { id, name: 'Neu' };

		const db = await openLibraryDb(dbName);
		await putRecord(db, 'events', original);
		await putRecord(db, 'events', updated);
		db.close();

		const reopened = await openLibraryDb(dbName);
		const library = await loadLibrary(reopened);

		expect(library.events[id]).toEqual(updated);
		expect(Object.keys(library.events)).toHaveLength(1);
		reopened.close();
	});
});
