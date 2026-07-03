// Person: a human identity persisting across Events. The only built-in field is the
// name; everything else is left to Custom Fields. Framework-free — no `svelte` imports.
import { newRecordId } from './ids';
import type { LibraryRecord } from './library';

export interface Person extends LibraryRecord {
	readonly name: string;
}

function normalizePersonName(name: string): string {
	const trimmedName = name.trim();
	if (trimmedName === '') {
		throw new Error('Person name must not be blank');
	}
	return trimmedName;
}

/** Create a Person from organizer input. Blank names are rejected. */
export function createPerson(name: string): Person {
	return { id: newRecordId(), name: normalizePersonName(name) };
}

/** The shared Person pool sorted by name, for picking an existing Person. */
export function listPersonsByName(persons: Record<string, Person>): Person[] {
	return Object.values(persons).sort((a, b) => a.name.localeCompare(b.name));
}
