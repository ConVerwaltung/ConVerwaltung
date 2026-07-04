import { newRecordId } from './ids';
import { compareByCreation, type Library, type LibraryRecord, type RecordKey } from './library';

export interface Event extends LibraryRecord {
	readonly name: string;
}

function normalizeEventName(name: string): string {
	const trimmedName = name.trim();
	if (trimmedName === '') {
		throw new Error('Event name must not be blank');
	}
	return trimmedName;
}

export function createEvent(name: string): Event {
	return { id: newRecordId(), name: normalizeEventName(name) };
}

export function renameEvent(event: Event, name: string): Event {
	return { ...event, name: normalizeEventName(name) };
}

// Persons are never Event-scoped: those left without Participants are retained
// as orphans; only Erasure removes a Person.
export function collectEventScopedDeletions(library: Library, eventId: string): RecordKey[] {
	const deletions: RecordKey[] = [{ section: 'events', id: eventId }];
	for (const participant of Object.values(library.participants)) {
		if (participant.event === eventId) {
			deletions.push({ section: 'participants', id: participant.id });
		}
	}
	for (const role of Object.values(library.roles)) {
		if (role.event === eventId) {
			deletions.push({ section: 'roles', id: role.id });
		}
	}
	for (const definition of Object.values(library.customFields)) {
		if (definition.event === eventId) {
			deletions.push({ section: 'customFields', id: definition.id });
		}
	}
	return deletions;
}

export function listEventsByCreation(events: Record<string, Event>): Event[] {
	return Object.values(events).sort(compareByCreation);
}
