import type { CustomValuedRecord } from './custom-field';
import { newRecordId } from './ids';
import type { RecordKey } from './library';
import type { NotedRecord } from './note';
import type { Participant } from './participant';

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

// Erasure (ADR-0005): unlike the scoped deletes, this removes the Person across
// every Event. Notes and Custom Field values live on the removed records
// themselves, so nothing of the individual survives. No tombstone in the
// initial release (ADR-0007).
export function collectErasureDeletions(
	participants: Record<string, Participant>,
	personId: string
): RecordKey[] {
	const deletions: RecordKey[] = [{ section: 'persons', id: personId }];
	for (const participant of Object.values(participants)) {
		if (participant.person === personId) {
			deletions.push({ section: 'participants', id: participant.id });
		}
	}
	return deletions;
}
