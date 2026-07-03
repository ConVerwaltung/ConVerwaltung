// Participant: a specific Person's involvement in a specific Event. Built-in structure
// is `event`, `person`, `roles`; everything else is left to Custom Fields. Framework-free
// — no `svelte` imports.
import { newRecordId } from './ids';
import type { EventScopedRecord } from './library';

export interface Participant extends EventScopedRecord {
	readonly person: string;
	readonly roles: readonly string[];
}

/** Whether the Person already takes part in the Event. */
export function isParticipant(
	participants: Record<string, Participant>,
	eventId: string,
	personId: string
): boolean {
	return Object.values(participants).some(
		(participant) => participant.event === eventId && participant.person === personId
	);
}

/**
 * Add a Person to an Event as a Participant. A Person takes part in an Event at most
 * once; adding them again is rejected. Roles stay empty until the organizer assigns them.
 */
export function addParticipant(
	participants: Record<string, Participant>,
	eventId: string,
	personId: string
): Participant {
	if (isParticipant(participants, eventId, personId)) {
		throw new Error('Person is already a Participant in this Event');
	}
	return { id: newRecordId(), event: eventId, person: personId, roles: [] };
}

/** One Event's Participants in creation order — UUID v7 keys sort chronologically. */
export function listParticipants(
	participants: Record<string, Participant>,
	eventId: string
): Participant[] {
	return Object.values(participants)
		.filter((participant) => participant.event === eventId)
		.sort((a, b) => a.id.localeCompare(b.id));
}
