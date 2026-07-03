// Event (CONTEXT.md): a single event, the top-level entity everything else is scoped to.
// Minimal built-in schema (ADR-0002): a name and nothing else. Framework-free — no
// `svelte` imports.
import { newRecordId } from './ids';
import type { Library, LibraryRecord, RecordKey } from './library';

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

/** Create an Event from organizer input. Blank names are rejected. */
export function createEvent(name: string): Event {
	return { id: newRecordId(), name: normalizeEventName(name) };
}

/** Rename an Event. Blank names are rejected. */
export function renameEvent(event: Event, name: string): Event {
	return { ...event, name: normalizeEventName(name) };
}

/**
 * The records a scoped delete of an Event removes: the Event itself and everything
 * scoped to it — its Participants and Roles (later slices add Participant-level
 * Custom Field definitions to that scope). Persons are never included: those left
 * with zero Participants become orphans and are retained; only Erasure removes a
 * Person (ADR-0005).
 */
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
	return deletions;
}

/** All Events in creation order — UUID v7 keys sort chronologically (ADR-0006). */
export function listEventsByCreation(events: Record<string, Event>): Event[] {
	return Object.values(events).sort((a, b) => a.id.localeCompare(b.id));
}
