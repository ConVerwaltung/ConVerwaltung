import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createEmptyLibrary } from '$lib/domain/library';
import { createEvent } from '$lib/domain/event';
import { newRecordId } from '$lib/domain/ids';
import { deleteRecords, loadLibrary, openLibraryDb, putRecord } from './library-db';

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
		const role = { id: newRecordId(), event: event.id, name: 'Sprecherin' };
		const participant = {
			id: newRecordId(),
			event: event.id,
			person: person.id,
			roles: [role.id]
		};

		const db = await openLibraryDb(dbName);
		await putRecord(db, 'events', event);
		await putRecord(db, 'persons', person);
		await putRecord(db, 'roles', role);
		await putRecord(db, 'participants', participant);
		db.close();

		const reopened = await openLibraryDb(dbName);
		const library = await loadLibrary(reopened);

		const expected = createEmptyLibrary();
		expected.events[event.id] = event;
		expected.persons[person.id] = person;
		expected.roles[role.id] = role;
		expected.participants[participant.id] = participant;
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

	it('deleteRecords removes the given records across sections, others survive reload', async () => {
		const dbName = uniqueDbName();
		const event = createEvent('Sommerfest 2026');
		const doomedParticipant = { id: newRecordId(), event: event.id, person: 'ada', roles: [] };
		const otherParticipant = { id: newRecordId(), event: newRecordId(), person: 'ada', roles: [] };
		const person = { id: newRecordId(), name: 'Ada Lovelace' };

		const db = await openLibraryDb(dbName);
		await putRecord(db, 'events', event);
		await putRecord(db, 'participants', doomedParticipant);
		await putRecord(db, 'participants', otherParticipant);
		await putRecord(db, 'persons', person);
		await deleteRecords(db, [
			{ section: 'events', id: event.id },
			{ section: 'participants', id: doomedParticipant.id }
		]);
		db.close();

		const reopened = await openLibraryDb(dbName);
		const library = await loadLibrary(reopened);

		const expected = createEmptyLibrary();
		expected.participants[otherParticipant.id] = otherParticipant;
		expected.persons[person.id] = person;
		expect(library).toEqual(expected);
		reopened.close();
	});

	it('deleteRecords with no keys is a no-op', async () => {
		const db = await openLibraryDb(uniqueDbName());

		await expect(deleteRecords(db, [])).resolves.toBeUndefined();
		db.close();
	});
});
