import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { CustomFieldDefinition } from '$lib/domain/custom-field';
import { createEmptyLibrary } from '$lib/domain/library';
import { createEvent } from '$lib/domain/event';
import { newRecordId } from '$lib/domain/ids';
import { collectErasureDeletions } from '$lib/domain/person';
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

	it('round-trips a Custom Field definition and a Person value through save and reload', async () => {
		const dbName = uniqueDbName();
		const definition: CustomFieldDefinition = {
			id: newRecordId(),
			level: 'person',
			type: 'text',
			name: 'E-Mail'
		};
		const person = {
			id: newRecordId(),
			name: 'Ada Lovelace',
			customValues: { [definition.id]: 'ada@example.org' }
		};

		const db = await openLibraryDb(dbName);
		await putRecord(db, 'customFields', definition);
		await putRecord(db, 'persons', person);
		db.close();

		const reopened = await openLibraryDb(dbName);
		const library = await loadLibrary(reopened);

		expect(library.customFields[definition.id]).toEqual(definition);
		expect(library.persons[person.id]).toEqual(person);
		reopened.close();
	});

	it('preserves line breaks in a Note through save and reload', async () => {
		const dbName = uniqueDbName();
		const person = { id: newRecordId(), name: 'Ada Lovelace', note: 'Zeile 1\nZeile 2' };

		const db = await openLibraryDb(dbName);
		await putRecord(db, 'persons', person);
		db.close();

		const reopened = await openLibraryDb(dbName);
		const library = await loadLibrary(reopened);

		expect(library.persons[person.id].note).toBe('Zeile 1\nZeile 2');
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

	it('after Erasure nothing of the Person remains in IndexedDB (ADR-0005)', async () => {
		const dbName = uniqueDbName();
		const summerFest = createEvent('Sommerfest');
		const autumnFest = createEvent('Herbstfest');
		const role = { id: newRecordId(), event: summerFest.id, name: 'Gast' };
		const personField: CustomFieldDefinition = {
			id: newRecordId(),
			level: 'person',
			type: 'text',
			name: 'E-Mail'
		};
		const participantField: CustomFieldDefinition = {
			id: newRecordId(),
			level: 'participant',
			type: 'text',
			event: summerFest.id,
			name: 'Zimmer'
		};
		const ada = {
			id: newRecordId(),
			name: 'Ada Lovelace',
			note: 'Vegetarierin',
			customValues: { [personField.id]: 'ada@example.org' }
		};
		const adaAtSummerFest = {
			id: newRecordId(),
			event: summerFest.id,
			person: ada.id,
			roles: [role.id],
			note: 'Reist früher ab',
			customValues: { [participantField.id]: '204' }
		};
		const adaAtAutumnFest = {
			id: newRecordId(),
			event: autumnFest.id,
			person: ada.id,
			roles: []
		};
		const grace = { id: newRecordId(), name: 'Grace Hopper' };
		const graceAtSummerFest = {
			id: newRecordId(),
			event: summerFest.id,
			person: grace.id,
			roles: [role.id]
		};

		const db = await openLibraryDb(dbName);
		await putRecord(db, 'events', summerFest);
		await putRecord(db, 'events', autumnFest);
		await putRecord(db, 'roles', role);
		await putRecord(db, 'customFields', personField);
		await putRecord(db, 'customFields', participantField);
		await putRecord(db, 'persons', ada);
		await putRecord(db, 'persons', grace);
		await putRecord(db, 'participants', adaAtSummerFest);
		await putRecord(db, 'participants', adaAtAutumnFest);
		await putRecord(db, 'participants', graceAtSummerFest);

		const participants = {
			[adaAtSummerFest.id]: adaAtSummerFest,
			[adaAtAutumnFest.id]: adaAtAutumnFest,
			[graceAtSummerFest.id]: graceAtSummerFest
		};
		await deleteRecords(db, collectErasureDeletions(participants, ada.id));
		db.close();

		const reopened = await openLibraryDb(dbName);
		const library = await loadLibrary(reopened);

		const expected = createEmptyLibrary();
		expected.events[summerFest.id] = summerFest;
		expected.events[autumnFest.id] = autumnFest;
		expected.roles[role.id] = role;
		expected.customFields[personField.id] = personField;
		expected.customFields[participantField.id] = participantField;
		expected.persons[grace.id] = grace;
		expected.participants[graceAtSummerFest.id] = graceAtSummerFest;
		expect(library).toEqual(expected);

		// No trace across all stores: neither ids nor personal data, no tombstone.
		const serialized = JSON.stringify(library);
		expect(serialized).not.toContain(ada.id);
		expect(serialized).not.toContain('Ada Lovelace');
		expect(serialized).not.toContain('Vegetarierin');
		expect(serialized).not.toContain('Reist früher ab');
		reopened.close();
	});

	it('deleteRecords with no keys is a no-op', async () => {
		const db = await openLibraryDb(uniqueDbName());

		await expect(deleteRecords(db, [])).resolves.toBeUndefined();
		db.close();
	});
});
