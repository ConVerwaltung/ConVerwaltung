import { newRecordId } from './ids';
import { compareByCreation, type EventScopedRecord, type RecordKey } from './library';
import type { Participant } from './participant';

export interface Role extends EventScopedRecord {
	readonly name: string;
}

export function isRoleNameDefined(
	roles: Record<string, Role>,
	eventId: string,
	name: string
): boolean {
	const trimmedName = name.trim();
	return Object.values(roles).some((role) => role.event === eventId && role.name === trimmedName);
}

function normalizeRoleName(roles: Record<string, Role>, eventId: string, name: string): string {
	const trimmedName = name.trim();
	if (trimmedName === '') {
		throw new Error('Role name must not be blank');
	}
	if (isRoleNameDefined(roles, eventId, trimmedName)) {
		throw new Error('Role name is already defined in this Event');
	}
	return trimmedName;
}

export function defineRole(roles: Record<string, Role>, eventId: string, name: string): Role {
	return { id: newRecordId(), event: eventId, name: normalizeRoleName(roles, eventId, name) };
}

export function renameRole(roles: Record<string, Role>, role: Role, name: string): Role {
	const otherRoles = Object.fromEntries(
		Object.entries(roles).filter(([id]) => id !== role.id)
	);
	return { ...role, name: normalizeRoleName(otherRoles, role.event, name) };
}

export function listRoles(roles: Record<string, Role>, eventId: string): Role[] {
	return Object.values(roles)
		.filter((role) => role.event === eventId)
		.sort(compareByCreation);
}

export function copyRoles(
	roles: Record<string, Role>,
	sourceEventId: string,
	targetEventId: string
): Role[] {
	return listRoles(roles, sourceEventId)
		.filter((role) => !isRoleNameDefined(roles, targetEventId, role.name))
		.map((role) => ({ id: newRecordId(), event: targetEventId, name: role.name }));
}

export function assignRole(participant: Participant, role: Role): Participant {
	if (role.event !== participant.event) {
		throw new Error('Role is defined in a different Event');
	}
	if (participant.roles.includes(role.id)) {
		throw new Error('Role is already assigned to this Participant');
	}
	return { ...participant, roles: [...participant.roles, role.id] };
}

export function unassignRole(participant: Participant, roleId: string): Participant {
	if (!participant.roles.includes(roleId)) {
		throw new Error('Role is not assigned to this Participant');
	}
	return { ...participant, roles: participant.roles.filter((id) => id !== roleId) };
}

export function removeRoleDefinition(
	participants: Record<string, Participant>,
	roleId: string
): { deletions: RecordKey[]; unassignedParticipants: Participant[] } {
	const unassignedParticipants = Object.values(participants)
		.filter((participant) => participant.roles.includes(roleId))
		.map((participant) => unassignRole(participant, roleId));
	return { deletions: [{ section: 'roles', id: roleId }], unassignedParticipants };
}
