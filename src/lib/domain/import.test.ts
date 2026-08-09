import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import type { CustomFieldDefinition } from './custom-field';
import { planImport } from './import';
import type { ImportDecision } from './import-match';
import type { ShapedRow } from './import-mapping';
import { createEmptyLibrary, type Library } from './library';
import type { Participant } from './participant';
import type { Person } from './person';
import type { Role } from './role';

const eventId = 'summer-fest';

const club: CustomFieldDefinition = { id: 'cf-club', level: 'person', type: 'text', name: 'Verein' };
const age: CustomFieldDefinition = { id: 'cf-age', level: 'person', type: 'number', name: 'Alter' };
const room: CustomFieldDefinition = {
	id: 'cf-room',
	level: 'participant',
	type: 'text',
	name: 'Zimmer',
	event: eventId
};
const roomElsewhere: CustomFieldDefinition = {
	id: 'cf-room-autumn',
	level: 'participant',
	type: 'text',
	name: 'Zimmer',
	event: 'autumn-fest'
};

const guest: Role = { id: 'role-guest', event: eventId, name: 'Gast' };
const helper: Role = { id: 'role-helper', event: eventId, name: 'Helferin' };
const helperElsewhere: Role = { id: 'role-helper-autumn', event: 'autumn-fest', name: 'Helferin' };

const customFields: Record<string, CustomFieldDefinition> = {
	[club.id]: club,
	[age.id]: age,
	[room.id]: room,
	[roomElsewhere.id]: roomElsewhere
};
const roles: Record<string, Role> = {
	[guest.id]: guest,
	[helper.id]: helper,
	[helperElsewhere.id]: helperElsewhere
};

const ada: Person = { id: 'p-ada', name: 'Ada Lovelace', customValues: { [club.id]: 'SV Süd' } };

function library(overrides: Partial<Library> = {}): Library {
	return { ...createEmptyLibrary(), customFields, roles, ...overrides };
}

function personPool(...persons: Person[]): Record<string, Person> {
	return Object.fromEntries(persons.map((person) => [person.id, person]));
}

function participantPool(...participants: Participant[]): Record<string, Participant> {
	return Object.fromEntries(participants.map((participant) => [participant.id, participant]));
}

function row(overrides: Partial<ShapedRow> = {}): ShapedRow {
	return {
		personName: 'Ada Lovelace',
		personValues: {},
		participantValues: {},
		roleNames: [],
		...overrides
	};
}

const asNewPerson: ImportDecision = { kind: 'new' };

function linkedTo(personId: string): ImportDecision {
	return { kind: 'link', personId };
}

function decisions(...perRow: ImportDecision[]): Map<number, ImportDecision> {
	return new Map(perRow.map((decision, index) => [index + 1, decision]));
}

describe('planImport with a new-Person decision', () => {
	it('creates a Person and a Participant per row, with values at both levels and Roles', () => {
		const plan = planImport(
			library(),
			eventId,
			[
				row({
					personName: 'Ada Lovelace',
					personValues: { [club.id]: 'SV Nord', [age.id]: '36' },
					participantValues: { Zimmer: '12' },
					roleNames: ['Gast']
				})
			],
			decisions(asNewPerson)
		);

		const [person] = plan.newPersons;
		const [participant] = plan.newParticipants;
		expect(person.name).toBe('Ada Lovelace');
		expect(person.customValues).toEqual({ [club.id]: 'SV Nord', [age.id]: '36' });
		expect(participant.event).toBe(eventId);
		expect(participant.person).toBe(person.id);
		expect(participant.customValues).toEqual({ [room.id]: '12' });
		expect(participant.roles).toEqual([guest.id]);
		expect(plan.linkedPersons).toEqual([]);
		expect(plan.updatedParticipants).toEqual([]);
		expect(plan.skippedRowNumbers).toEqual([]);
		expect(plan.unknownRoleNames).toEqual([]);
		expect(plan.rejectedValues).toEqual([]);
	});

	it('gives every record a fresh UUID v7 id', () => {
		const plan = planImport(
			library(),
			eventId,
			[row(), row()],
			decisions(asNewPerson, asNewPerson)
		);

		const ids = [...plan.newPersons, ...plan.newParticipants].map((record) => record.id);
		expect(ids.every((id) => uuidValidate(id) && uuidVersion(id) === 7)).toBe(true);
		expect(new Set(ids).size).toBe(4);
	});

	it('creates a separate Person per row, even for the same name', () => {
		const plan = planImport(
			library(),
			eventId,
			[row({ personName: 'Ada Lovelace' }), row({ personName: 'Ada Lovelace' })],
			decisions(asNewPerson, asNewPerson)
		);

		expect(plan.newPersons).toHaveLength(2);
		expect(plan.newPersons[0].id).not.toBe(plan.newPersons[1].id);
		expect(plan.newParticipants.map((participant) => participant.person)).toEqual(
			plan.newPersons.map((person) => person.id)
		);
	});

	it('leaves records without values free of a customValues entry', () => {
		const plan = planImport(library(), eventId, [row()], decisions(asNewPerson));

		expect(plan.newPersons[0].customValues).toBeUndefined();
		expect(plan.newParticipants[0].customValues).toBeUndefined();
		expect(plan.newParticipants[0].roles).toEqual([]);
	});

	it('reports Role names the Event does not define, once each, and assigns the rest', () => {
		const plan = planImport(
			library(),
			eventId,
			[row({ roleNames: ['Gast', 'Sponsorin'] }), row({ roleNames: ['Sponsorin', 'Gönnerin'] })],
			decisions(asNewPerson, asNewPerson)
		);

		expect(plan.newParticipants.map((participant) => participant.roles)).toEqual([[guest.id], []]);
		expect(plan.unknownRoleNames).toEqual(['Sponsorin', 'Gönnerin']);
	});

	it('reports values that do not fit their Custom Field type and writes the others', () => {
		const plan = planImport(
			library(),
			eventId,
			[row({ personValues: { [club.id]: 'SV Nord', [age.id]: 'sechsunddreißig' } })],
			decisions(asNewPerson)
		);

		expect(plan.newPersons[0].customValues).toEqual({ [club.id]: 'SV Nord' });
		expect(plan.rejectedValues).toEqual([
			{ rowNumber: 1, fieldName: 'Alter', value: 'sechsunddreißig' }
		]);
	});

	it('resolves Participant-level values by field name within the Event only', () => {
		const elsewhereOnly = library({ customFields: { [roomElsewhere.id]: roomElsewhere } });
		const plan = planImport(
			elsewhereOnly,
			eventId,
			[row({ participantValues: { Zimmer: '12' } })],
			decisions(asNewPerson)
		);

		expect(plan.newParticipants[0].customValues).toBeUndefined();
	});

	it('ignores Person-level values whose definition no longer exists', () => {
		const plan = planImport(
			library(),
			eventId,
			[row({ personValues: { 'cf-gone': 'SV Nord' } })],
			decisions(asNewPerson)
		);

		expect(plan.newPersons[0].customValues).toBeUndefined();
		expect(plan.rejectedValues).toEqual([]);
	});
});

describe('planImport with a link decision', () => {
	it('reuses the existing Person and creates only a Participant', () => {
		const withAda = library({ persons: personPool(ada) });
		const plan = planImport(
			withAda,
			eventId,
			[row({ personName: 'Ada Lovelace' })],
			decisions(linkedTo(ada.id))
		);

		expect(plan.newPersons).toEqual([]);
		expect(plan.linkedPersons.map((person) => person.id)).toEqual([ada.id]);
		expect(plan.newParticipants).toHaveLength(1);
		expect(plan.newParticipants[0].person).toBe(ada.id);
		expect(plan.newParticipants[0].event).toBe(eventId);
		expect(plan.updatedParticipants).toEqual([]);
	});

	it('overwrites the mapped Person values and keeps the unmapped ones', () => {
		const withAda = library({ persons: personPool(ada) });
		const plan = planImport(
			withAda,
			eventId,
			[row({ personValues: { [age.id]: '36' } })],
			decisions(linkedTo(ada.id))
		);

		expect(plan.linkedPersons[0].customValues).toEqual({ [club.id]: 'SV Süd', [age.id]: '36' });
	});

	it('updates the existing Participant when the Person already takes part in the Event', () => {
		const existing: Participant = {
			id: 'pa-ada',
			event: eventId,
			person: ada.id,
			roles: [guest.id],
			customValues: { [room.id]: '3' },
			note: 'kommt später'
		};
		const withAda = library({
			persons: personPool(ada),
			participants: participantPool(existing)
		});
		const plan = planImport(
			withAda,
			eventId,
			[row({ participantValues: { Zimmer: '12' }, roleNames: ['Helferin'] })],
			decisions(linkedTo(ada.id))
		);

		expect(plan.newParticipants).toEqual([]);
		expect(plan.updatedParticipants).toHaveLength(1);
		const [participant] = plan.updatedParticipants;
		expect(participant.id).toBe(existing.id);
		expect(participant.customValues).toEqual({ [room.id]: '12' });
		expect(participant.roles).toEqual([guest.id, helper.id]);
		expect(participant.note).toBe('kommt später');
	});

	it('ignores a Participant of the same Person in another Event', () => {
		const elsewhere: Participant = {
			id: 'pa-ada-autumn',
			event: 'autumn-fest',
			person: ada.id,
			roles: []
		};
		const withAda = library({
			persons: personPool(ada),
			participants: participantPool(elsewhere)
		});
		const plan = planImport(withAda, eventId, [row()], decisions(linkedTo(ada.id)));

		expect(plan.newParticipants).toHaveLength(1);
		expect(plan.newParticipants[0].id).not.toBe(elsewhere.id);
		expect(plan.updatedParticipants).toEqual([]);
	});

	it('folds several rows linked to the same Person into one Participant', () => {
		const withAda = library({ persons: personPool(ada) });
		const plan = planImport(
			withAda,
			eventId,
			[
				row({ personValues: { [age.id]: '36' }, roleNames: ['Gast'] }),
				row({ participantValues: { Zimmer: '12' }, roleNames: ['Helferin'] })
			],
			decisions(linkedTo(ada.id), linkedTo(ada.id))
		);

		expect(plan.linkedPersons).toHaveLength(1);
		expect(plan.linkedPersons[0].customValues).toEqual({ [club.id]: 'SV Süd', [age.id]: '36' });
		expect(plan.newParticipants).toHaveLength(1);
		expect(plan.newParticipants[0].roles).toEqual([guest.id, helper.id]);
		expect(plan.newParticipants[0].customValues).toEqual({ [room.id]: '12' });
		expect(plan.updatedParticipants).toEqual([]);
	});

	it('mixes linked and new rows in one plan', () => {
		const withAda = library({ persons: personPool(ada) });
		const plan = planImport(
			withAda,
			eventId,
			[row({ personName: 'Ada Lovelace' }), row({ personName: 'Grace Hopper' })],
			decisions(linkedTo(ada.id), asNewPerson)
		);

		expect(plan.linkedPersons.map((person) => person.id)).toEqual([ada.id]);
		expect(plan.newPersons.map((person) => person.name)).toEqual(['Grace Hopper']);
		expect(plan.newParticipants).toHaveLength(2);
	});
});

describe('planImport row decisions', () => {
	it('skips rows without a Person name and reports their position, committing the rest', () => {
		const plan = planImport(
			library(),
			eventId,
			[row({ personName: '' }), row({ personName: 'Grace Hopper' }), row({ personName: '' })],
			new Map([[2, asNewPerson]])
		);

		expect(plan.newPersons.map((person) => person.name)).toEqual(['Grace Hopper']);
		expect(plan.newParticipants).toHaveLength(1);
		expect(plan.skippedRowNumbers).toEqual([1, 3]);
	});

	it('refuses to plan a named row that is still undecided', () => {
		expect(() => planImport(library(), eventId, [row(), row()], decisions(asNewPerson))).toThrow(
			'Row 2 is still undecided'
		);
	});

	it('plans nothing for an empty file', () => {
		const plan = planImport(library(), eventId, [], new Map());

		expect(plan).toEqual({
			newPersons: [],
			linkedPersons: [],
			newParticipants: [],
			updatedParticipants: [],
			skippedRowNumbers: [],
			unknownRoleNames: [],
			rejectedValues: []
		});
	});
});
