import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import type { CustomFieldDefinition } from './custom-field';
import { planImport } from './import';
import type { ShapedRow } from './import-mapping';
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
const helperElsewhere: Role = { id: 'role-helper-autumn', event: 'autumn-fest', name: 'Helferin' };

const customFields: Record<string, CustomFieldDefinition> = {
	[club.id]: club,
	[age.id]: age,
	[room.id]: room,
	[roomElsewhere.id]: roomElsewhere
};
const roles: Record<string, Role> = { [guest.id]: guest, [helperElsewhere.id]: helperElsewhere };

function row(overrides: Partial<ShapedRow> = {}): ShapedRow {
	return {
		personName: 'Ada Lovelace',
		personValues: {},
		participantValues: {},
		roleNames: [],
		...overrides
	};
}

describe('planImport', () => {
	it('creates a Person and a Participant per row, with values at both levels and Roles', () => {
		const plan = planImport(customFields, roles, eventId, [
			row({
				personName: 'Ada Lovelace',
				personValues: { [club.id]: 'SV Nord', [age.id]: '36' },
				participantValues: { Zimmer: '12' },
				roleNames: ['Gast']
			})
		]);

		const [person] = plan.persons;
		const [participant] = plan.participants;
		expect(person.name).toBe('Ada Lovelace');
		expect(person.customValues).toEqual({ [club.id]: 'SV Nord', [age.id]: '36' });
		expect(participant.event).toBe(eventId);
		expect(participant.person).toBe(person.id);
		expect(participant.customValues).toEqual({ [room.id]: '12' });
		expect(participant.roles).toEqual([guest.id]);
		expect(plan.skippedRowNumbers).toEqual([]);
		expect(plan.unknownRoleNames).toEqual([]);
		expect(plan.rejectedValues).toEqual([]);
	});

	it('gives every record a fresh UUID v7 id', () => {
		const plan = planImport(customFields, roles, eventId, [row(), row()]);

		const ids = [...plan.persons, ...plan.participants].map((record) => record.id);
		expect(ids.every((id) => uuidValidate(id) && uuidVersion(id) === 7)).toBe(true);
		expect(new Set(ids).size).toBe(4);
	});

	it('creates a separate Person per row, even for the same name', () => {
		const plan = planImport(customFields, roles, eventId, [
			row({ personName: 'Ada Lovelace' }),
			row({ personName: 'Ada Lovelace' })
		]);

		expect(plan.persons).toHaveLength(2);
		expect(plan.persons[0].id).not.toBe(plan.persons[1].id);
		expect(plan.participants.map((participant) => participant.person)).toEqual(
			plan.persons.map((person) => person.id)
		);
	});

	it('leaves records without values free of a customValues entry', () => {
		const plan = planImport(customFields, roles, eventId, [row()]);

		expect(plan.persons[0].customValues).toBeUndefined();
		expect(plan.participants[0].customValues).toBeUndefined();
		expect(plan.participants[0].roles).toEqual([]);
	});

	it('reports Role names the Event does not define, once each, and assigns the rest', () => {
		const plan = planImport(customFields, roles, eventId, [
			row({ roleNames: ['Gast', 'Helferin'] }),
			row({ roleNames: ['Helferin', 'Sponsorin'] })
		]);

		expect(plan.participants.map((participant) => participant.roles)).toEqual([[guest.id], []]);
		expect(plan.unknownRoleNames).toEqual(['Helferin', 'Sponsorin']);
	});

	it('skips rows without a Person name and reports their position, committing the rest', () => {
		const plan = planImport(customFields, roles, eventId, [
			row({ personName: '' }),
			row({ personName: 'Grace Hopper' }),
			row({ personName: '' })
		]);

		expect(plan.persons.map((person) => person.name)).toEqual(['Grace Hopper']);
		expect(plan.participants).toHaveLength(1);
		expect(plan.skippedRowNumbers).toEqual([1, 3]);
	});

	it('reports values that do not fit their Custom Field type and writes the others', () => {
		const plan = planImport(customFields, roles, eventId, [
			row({ personValues: { [club.id]: 'SV Nord', [age.id]: 'sechsunddreißig' } })
		]);

		expect(plan.persons[0].customValues).toEqual({ [club.id]: 'SV Nord' });
		expect(plan.rejectedValues).toEqual([
			{ rowNumber: 1, fieldName: 'Alter', value: 'sechsunddreißig' }
		]);
	});

	it('resolves Participant-level values by field name within the Event only', () => {
		const plan = planImport({ [roomElsewhere.id]: roomElsewhere }, roles, eventId, [
			row({ participantValues: { Zimmer: '12' } })
		]);

		expect(plan.participants[0].customValues).toBeUndefined();
	});

	it('ignores Person-level values whose definition no longer exists', () => {
		const plan = planImport(customFields, roles, eventId, [
			row({ personValues: { 'cf-gone': 'SV Nord' } })
		]);

		expect(plan.persons[0].customValues).toBeUndefined();
		expect(plan.rejectedValues).toEqual([]);
	});

	it('plans nothing for an empty file', () => {
		const plan = planImport(customFields, roles, eventId, []);

		expect(plan).toEqual({
			persons: [],
			participants: [],
			skippedRowNumbers: [],
			unknownRoleNames: [],
			rejectedValues: []
		});
	});
});
