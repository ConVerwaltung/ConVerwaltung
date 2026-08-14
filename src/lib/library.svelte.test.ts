import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { newRecordId } from '$lib/domain/ids';
import type { RecordPut } from '$lib/domain/library';
import type { Person } from '$lib/domain/person';
import { bootLibrary, commitBatch, libraryState, upsertRecord } from '$lib/library.svelte';

/** A null id is not a valid IndexedDB key, so the write fails at the store edge. */
function unstorablePerson(): Person {
	return { id: null, name: 'Ada Lovelace' } as unknown as Person;
}

describe('the write contract', () => {
	beforeAll(async () => {
		await bootLibrary();
	});

	it('a rejected write leaves the in-memory Library unchanged and names the cause', async () => {
		const personCount = Object.keys(libraryState.library.persons).length;

		await upsertRecord('persons', unstorablePerson());

		expect(Object.keys(libraryState.library.persons)).toHaveLength(personCount);
		expect(libraryState.writeFailure).not.toBeNull();
	});

	it('a batch that fails to persist applies none of its records', async () => {
		const storable = { id: newRecordId(), name: 'Grace Hopper' };
		const puts: RecordPut[] = [
			{ section: 'persons', record: storable },
			{ section: 'persons', record: unstorablePerson() }
		];

		await commitBatch({ puts });

		expect(libraryState.library.persons[storable.id]).toBeUndefined();
	});

	it('the next write that persists clears the failure', async () => {
		const person = { id: newRecordId(), name: 'Grace Hopper' };

		await upsertRecord('persons', unstorablePerson());
		await upsertRecord('persons', person);

		expect(libraryState.library.persons[person.id]).toEqual(person);
		expect(libraryState.writeFailure).toBeNull();
	});
});
