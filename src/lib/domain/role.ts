// Role (CONTEXT.md): the capacity in which a Participant takes part in an Event
// (guest, speaker, volunteer, organizer, …). The set of available Roles is
// organizer-defined per Event; one Participant can hold several Roles at once.
// Framework-free — no `svelte` imports.
import { newRecordId } from './ids';
import type { EventScopedRecord, RecordKey } from './library';
import type { Participant } from './participant';

export interface Role extends EventScopedRecord {
	readonly name: string;
}

/** Whether the Event already defines a Role with this name (after trimming). */
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

/**
 * Define a Role on an Event. Blank names and duplicates (same name, same Event) are
 * rejected; the same name in another Event is a distinct, unrelated Role.
 */
export function defineRole(roles: Record<string, Role>, eventId: string, name: string): Role {
	return { id: newRecordId(), event: eventId, name: normalizeRoleName(roles, eventId, name) };
}

/** Rename a Role. Blank names and duplicates within the Event are rejected. */
export function renameRole(roles: Record<string, Role>, role: Role, name: string): Role {
	const otherRoles = Object.fromEntries(
		Object.entries(roles).filter(([id]) => id !== role.id)
	);
	return { ...role, name: normalizeRoleName(otherRoles, role.event, name) };
}

/** One Event's Roles in creation order — UUID v7 keys sort chronologically. */
export function listRoles(roles: Record<string, Role>, eventId: string): Role[] {
	return Object.values(roles)
		.filter((role) => role.event === eventId)
		.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Copy another Event's Role set into the target Event (CONTEXT.md: a Role set "can be
 * copied from a previous event"). Copies are independent Event-scoped definitions with
 * new ids — later edits in either Event do not affect the other. Source Roles whose
 * name is already defined in the target Event are skipped, not duplicated.
 */
export function copyRoles(
	roles: Record<string, Role>,
	sourceEventId: string,
	targetEventId: string
): Role[] {
	return listRoles(roles, sourceEventId)
		.filter((role) => !isRoleNameDefined(roles, targetEventId, role.name))
		.map((role) => ({ id: newRecordId(), event: targetEventId, name: role.name }));
}

/** Assign a Role to a Participant. Only Roles of the Participant's own Event apply. */
export function assignRole(participant: Participant, role: Role): Participant {
	if (role.event !== participant.event) {
		throw new Error('Role is defined in a different Event');
	}
	if (participant.roles.includes(role.id)) {
		throw new Error('Role is already assigned to this Participant');
	}
	return { ...participant, roles: [...participant.roles, role.id] };
}

/** Unassign a Role from a Participant. */
export function unassignRole(participant: Participant, roleId: string): Participant {
	if (!participant.roles.includes(roleId)) {
		throw new Error('Role is not assigned to this Participant');
	}
	return { ...participant, roles: participant.roles.filter((id) => id !== roleId) };
}

/**
 * Removing a Role definition cascades the unassignment: the definition is deleted and
 * every Participant still holding the Role loses it. The UI states this in its
 * confirmation before committing. Returns the record to delete plus the updated
 * Participants to write back.
 */
export function removeRoleDefinition(
	participants: Record<string, Participant>,
	roleId: string
): { deletions: RecordKey[]; unassignedParticipants: Participant[] } {
	const unassignedParticipants = Object.values(participants)
		.filter((participant) => participant.roles.includes(roleId))
		.map((participant) => unassignRole(participant, roleId));
	return { deletions: [{ section: 'roles', id: roleId }], unassignedParticipants };
}
