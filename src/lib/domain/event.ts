// Event (CONTEXT.md): a single event, the top-level entity everything else is scoped to.
// Minimal built-in schema (ADR-0002): a name and nothing else. Framework-free — no
// `svelte` imports.
import { newRecordId } from './ids';
import type { LibraryRecord } from './library';

export interface Event extends LibraryRecord {
	readonly name: string;
}

/** Create an Event from organizer input. Blank names are rejected. */
export function createEvent(name: string): Event {
	const trimmedName = name.trim();
	if (trimmedName === '') {
		throw new Error('Event name must not be blank');
	}
	return { id: newRecordId(), name: trimmedName };
}

/** All Events in creation order — UUID v7 keys sort chronologically (ADR-0006). */
export function listEventsByCreation(events: Record<string, Event>): Event[] {
	return Object.values(events).sort((a, b) => a.id.localeCompare(b.id));
}
