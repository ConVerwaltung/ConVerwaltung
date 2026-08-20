import type { CustomValuedRecord } from './custom-field';
import { newRecordId } from './ids';
import { compareByCreation, type EventScopedRecord, type RecordKey } from './library';
import type { NotedRecord } from './note';

export interface Participant extends EventScopedRecord, NotedRecord, CustomValuedRecord {
	readonly person: string;
	/** Ids of Roles defined in the same Event. */
	readonly roles: readonly string[];
}

export function isParticipant(
	participants: Record<string, Participant>,
	eventId: string,
	personId: string
): boolean {
	return Object.values(participants).some(
		(participant) => participant.event === eventId && participant.person === personId
	);
}

export function createParticipant(
	eventId: string,
	personId: string,
	roles: readonly string[]
): Participant {
	return { id: newRecordId(), event: eventId, person: personId, roles };
}

export function addParticipant(
	participants: Record<string, Participant>,
	eventId: string,
	personId: string
): Participant {
	if (isParticipant(participants, eventId, personId)) {
		throw new Error('Person is already a Participant in this Event');
	}
	return createParticipant(eventId, personId, []);
}

// The Person is never included: left without Participants they are retained
// as orphans; only Erasure removes a Person.
export function collectParticipantScopedDeletions(participantId: string): RecordKey[] {
	return [{ section: 'participants', id: participantId }];
}

export function listParticipants(
	participants: Record<string, Participant>,
	eventId: string
): Participant[] {
	return Object.values(participants)
		.filter((participant) => participant.event === eventId)
		.sort(compareByCreation);
}

// The other way round: every Event one Person takes part in. The Person screen reads its
// Teilnahmen through this, and the Erasure dialog names the Events from it.
export function listParticipantsOfPerson(
	participants: Record<string, Participant>,
	personId: string
): Participant[] {
	return Object.values(participants)
		.filter((participant) => participant.person === personId)
		.sort(compareByCreation);
}
