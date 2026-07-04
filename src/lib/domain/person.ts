import type { CustomValuedRecord } from './custom-field';
import { newRecordId } from './ids';
import type { NotedRecord } from './note';

export interface Person extends NotedRecord, CustomValuedRecord {
	readonly name: string;
}

function normalizePersonName(name: string): string {
	const trimmedName = name.trim();
	if (trimmedName === '') {
		throw new Error('Person name must not be blank');
	}
	return trimmedName;
}

export function createPerson(name: string): Person {
	return { id: newRecordId(), name: normalizePersonName(name) };
}

export function listPersonsByName(persons: Record<string, Person>): Person[] {
	return Object.values(persons).sort((a, b) => a.name.localeCompare(b.name));
}
