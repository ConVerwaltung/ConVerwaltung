import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import {
	addParticipant,
	collectParticipantScopedDeletions,
	isParticipant,
	listParticipants,
	type Participant
} from './participant';
import { createEmptyLibrary } from './library';

function poolWith(...participants: Participant[]): Record<string, Participant> {
	return Object.fromEntries(participants.map((participant) => [participant.id, participant]));
}

describe('addParticipant', () => {
	it('creates a Participant linking the Person to the Event, with empty roles and a UUID v7 id', () => {
		const participant = addParticipant({}, 'summer-fest', 'ada');

		expect(participant.event).toBe('summer-fest');
		expect(participant.person).toBe('ada');
		expect(participant.roles).toEqual([]);
		expect(uuidValidate(participant.id)).toBe(true);
		expect(uuidVersion(participant.id)).toBe(7);
	});

	it('rejects a Person already taking part in the Event', () => {
		const existing = addParticipant({}, 'summer-fest', 'ada');

		expect(() => addParticipant(poolWith(existing), 'summer-fest', 'ada')).toThrow();
	});

	it('lets one Person hold Participants in two different Events', () => {
		const atSummerFest = addParticipant({}, 'summer-fest', 'ada');

		const atAutumnFest = addParticipant(poolWith(atSummerFest), 'autumn-fest', 'ada');

		expect(atSummerFest.person).toBe('ada');
		expect(atAutumnFest.person).toBe('ada');
		expect(atSummerFest.id).not.toBe(atAutumnFest.id);
	});

	it('lets different Persons take part in the same Event', () => {
		const ada = addParticipant({}, 'summer-fest', 'ada');

		const grace = addParticipant(poolWith(ada), 'summer-fest', 'grace');

		expect(grace.event).toBe('summer-fest');
		expect(grace.person).toBe('grace');
	});
});

describe('isParticipant', () => {
	it('is true only for the matching Event and Person pair', () => {
		const participant = addParticipant({}, 'summer-fest', 'ada');
		const participants = poolWith(participant);

		expect(isParticipant(participants, 'summer-fest', 'ada')).toBe(true);
		expect(isParticipant(participants, 'summer-fest', 'grace')).toBe(false);
		expect(isParticipant(participants, 'autumn-fest', 'ada')).toBe(false);
	});
});

describe('collectParticipantScopedDeletions', () => {
	it('removes only the Participant itself', () => {
		const deletions = collectParticipantScopedDeletions('pa1');

		expect(deletions).toEqual([{ section: 'participants', id: 'pa1' }]);
	});

	it('retains the Person when their last Participant is removed', () => {
		const library = createEmptyLibrary();
		library.persons['ada'] = { id: 'ada', name: 'Ada Lovelace' };
		library.participants['pa1'] = { id: 'pa1', event: 'summer-fest', person: 'ada', roles: [] };

		const deletions = collectParticipantScopedDeletions('pa1');
		for (const { section, id } of deletions) {
			delete library[section][id];
		}

		// Ada now has zero Participants — the orphan Person is retained.
		expect(library.participants).toEqual({});
		expect(Object.keys(library.persons)).toEqual(['ada']);
	});
});

describe('listParticipants', () => {
	it('is empty for an Event without Participants', () => {
		expect(listParticipants({}, 'summer-fest')).toEqual([]);
	});

	it('lists only the Event’s own Participants, in creation order of their UUID v7 ids', () => {
		const older: Participant = {
			id: '018f0000-0000-7000-8000-000000000000',
			event: 'summer-fest',
			person: 'ada',
			roles: []
		};
		const newer: Participant = {
			id: '01900000-0000-7000-8000-000000000000',
			event: 'summer-fest',
			person: 'grace',
			roles: []
		};
		const elsewhere: Participant = {
			id: '01910000-0000-7000-8000-000000000000',
			event: 'autumn-fest',
			person: 'ada',
			roles: []
		};

		const participants = listParticipants(poolWith(newer, elsewhere, older), 'summer-fest');

		expect(participants).toEqual([older, newer]);
	});
});
