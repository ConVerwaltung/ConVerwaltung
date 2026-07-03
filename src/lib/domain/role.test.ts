import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import {
	assignRole,
	defineRole,
	isRoleNameDefined,
	listRoles,
	removeRoleDefinition,
	renameRole,
	unassignRole,
	type Role
} from './role';
import { addParticipant, type Participant } from './participant';

function poolWith(...roles: Role[]): Record<string, Role> {
	return Object.fromEntries(roles.map((role) => [role.id, role]));
}

function participantsWith(...participants: Participant[]): Record<string, Participant> {
	return Object.fromEntries(participants.map((participant) => [participant.id, participant]));
}

describe('defineRole', () => {
	it('creates a Role scoped to the Event, with the given name and a UUID v7 id', () => {
		const role = defineRole({}, 'summer-fest', 'Sprecher');

		expect(role.event).toBe('summer-fest');
		expect(role.name).toBe('Sprecher');
		expect(uuidValidate(role.id)).toBe(true);
		expect(uuidVersion(role.id)).toBe(7);
	});

	it('trims surrounding whitespace from the name', () => {
		expect(defineRole({}, 'summer-fest', '  Sprecher  ').name).toBe('Sprecher');
	});

	it('rejects a blank name', () => {
		expect(() => defineRole({}, 'summer-fest', '')).toThrow();
		expect(() => defineRole({}, 'summer-fest', '   ')).toThrow();
	});

	it('rejects a duplicate name within the same Event, including after trimming', () => {
		const existing = defineRole({}, 'summer-fest', 'Sprecher');

		expect(() => defineRole(poolWith(existing), 'summer-fest', 'Sprecher')).toThrow();
		expect(() => defineRole(poolWith(existing), 'summer-fest', '  Sprecher ')).toThrow();
	});

	it('allows the same name in a different Event', () => {
		const existing = defineRole({}, 'summer-fest', 'Sprecher');

		const other = defineRole(poolWith(existing), 'autumn-fest', 'Sprecher');

		expect(other.event).toBe('autumn-fest');
		expect(other.id).not.toBe(existing.id);
	});
});

describe('renameRole', () => {
	it('changes the name and keeps id and Event', () => {
		const role = defineRole({}, 'summer-fest', 'Gast');

		const renamed = renameRole(poolWith(role), role, 'Sprecher');

		expect(renamed).toEqual({ id: role.id, event: 'summer-fest', name: 'Sprecher' });
	});

	it('rejects a blank new name', () => {
		const role = defineRole({}, 'summer-fest', 'Gast');

		expect(() => renameRole(poolWith(role), role, '   ')).toThrow();
	});

	it('rejects the name of another Role in the same Event', () => {
		const guest = defineRole({}, 'summer-fest', 'Gast');
		const speaker = defineRole(poolWith(guest), 'summer-fest', 'Sprecher');

		expect(() => renameRole(poolWith(guest, speaker), guest, 'Sprecher')).toThrow();
	});

	it('allows keeping the own name', () => {
		const role = defineRole({}, 'summer-fest', 'Gast');

		expect(renameRole(poolWith(role), role, 'Gast').name).toBe('Gast');
	});

	it('allows a name used in a different Event', () => {
		const guest = defineRole({}, 'summer-fest', 'Gast');
		const elsewhere = defineRole(poolWith(guest), 'autumn-fest', 'Sprecher');

		expect(renameRole(poolWith(guest, elsewhere), guest, 'Sprecher').name).toBe('Sprecher');
	});

	it('does not mutate the given Role', () => {
		const role = defineRole({}, 'summer-fest', 'Gast');

		renameRole(poolWith(role), role, 'Sprecher');

		expect(role.name).toBe('Gast');
	});
});

describe('isRoleNameDefined', () => {
	it('matches only within the given Event, after trimming', () => {
		const role = defineRole({}, 'summer-fest', 'Gast');
		const roles = poolWith(role);

		expect(isRoleNameDefined(roles, 'summer-fest', 'Gast')).toBe(true);
		expect(isRoleNameDefined(roles, 'summer-fest', ' Gast ')).toBe(true);
		expect(isRoleNameDefined(roles, 'summer-fest', 'Sprecher')).toBe(false);
		expect(isRoleNameDefined(roles, 'autumn-fest', 'Gast')).toBe(false);
	});
});

describe('listRoles', () => {
	it('is empty for an Event without Roles', () => {
		expect(listRoles({}, 'summer-fest')).toEqual([]);
	});

	it('lists only the Event’s own Roles, in creation order of their UUID v7 ids', () => {
		const older: Role = {
			id: '018f0000-0000-7000-8000-000000000000',
			event: 'summer-fest',
			name: 'Gast'
		};
		const newer: Role = {
			id: '01900000-0000-7000-8000-000000000000',
			event: 'summer-fest',
			name: 'Sprecher'
		};
		const elsewhere: Role = {
			id: '01910000-0000-7000-8000-000000000000',
			event: 'autumn-fest',
			name: 'Gast'
		};

		expect(listRoles(poolWith(newer, elsewhere, older), 'summer-fest')).toEqual([older, newer]);
	});
});

describe('assignRole', () => {
	it('adds the Role id, keeping already assigned Roles', () => {
		const guest = defineRole({}, 'summer-fest', 'Gast');
		const speaker = defineRole(poolWith(guest), 'summer-fest', 'Sprecher');
		const participant = addParticipant({}, 'summer-fest', 'ada');

		const withBoth = assignRole(assignRole(participant, guest), speaker);

		expect(withBoth.roles).toEqual([guest.id, speaker.id]);
	});

	it('rejects a Role defined in a different Event', () => {
		const elsewhere = defineRole({}, 'autumn-fest', 'Gast');
		const participant = addParticipant({}, 'summer-fest', 'ada');

		expect(() => assignRole(participant, elsewhere)).toThrow();
	});

	it('rejects a Role already assigned', () => {
		const guest = defineRole({}, 'summer-fest', 'Gast');
		const participant = assignRole(addParticipant({}, 'summer-fest', 'ada'), guest);

		expect(() => assignRole(participant, guest)).toThrow();
	});

	it('does not mutate the given Participant', () => {
		const guest = defineRole({}, 'summer-fest', 'Gast');
		const participant = addParticipant({}, 'summer-fest', 'ada');

		assignRole(participant, guest);

		expect(participant.roles).toEqual([]);
	});
});

describe('unassignRole', () => {
	it('removes only the given Role, keeping the others', () => {
		const guest = defineRole({}, 'summer-fest', 'Gast');
		const speaker = defineRole(poolWith(guest), 'summer-fest', 'Sprecher');
		const participant = assignRole(assignRole(addParticipant({}, 'summer-fest', 'ada'), guest), speaker);

		expect(unassignRole(participant, guest.id).roles).toEqual([speaker.id]);
	});

	it('rejects a Role that is not assigned', () => {
		const participant = addParticipant({}, 'summer-fest', 'ada');

		expect(() => unassignRole(participant, 'unassigned-role')).toThrow();
	});

	it('does not mutate the given Participant', () => {
		const guest = defineRole({}, 'summer-fest', 'Gast');
		const participant = assignRole(addParticipant({}, 'summer-fest', 'ada'), guest);

		unassignRole(participant, guest.id);

		expect(participant.roles).toEqual([guest.id]);
	});
});

describe('removeRoleDefinition', () => {
	it('deletes the Role record and cascades the unassignment to every holder', () => {
		const guest = defineRole({}, 'summer-fest', 'Gast');
		const speaker = defineRole(poolWith(guest), 'summer-fest', 'Sprecher');
		const ada = assignRole(assignRole(addParticipant({}, 'summer-fest', 'ada'), guest), speaker);
		const grace = assignRole(addParticipant(participantsWith(ada), 'summer-fest', 'grace'), guest);
		const kurt = addParticipant(participantsWith(ada, grace), 'summer-fest', 'kurt');

		const { deletions, unassignedParticipants } = removeRoleDefinition(
			participantsWith(ada, grace, kurt),
			guest.id
		);

		expect(deletions).toEqual([{ section: 'roles', id: guest.id }]);
		// Only the holders are updated; Kurt never held the Role and stays untouched.
		expect(unassignedParticipants.map((participant) => participant.id).sort()).toEqual(
			[ada.id, grace.id].sort()
		);
		for (const participant of unassignedParticipants) {
			expect(participant.roles).not.toContain(guest.id);
		}
		expect(unassignedParticipants.find((participant) => participant.id === ada.id)?.roles).toEqual(
			[speaker.id]
		);
	});

	it('deletes a Role no Participant holds without touching any Participant', () => {
		const guest = defineRole({}, 'summer-fest', 'Gast');
		const ada = addParticipant({}, 'summer-fest', 'ada');

		const { deletions, unassignedParticipants } = removeRoleDefinition(
			participantsWith(ada),
			guest.id
		);

		expect(deletions).toEqual([{ section: 'roles', id: guest.id }]);
		expect(unassignedParticipants).toEqual([]);
	});
});
