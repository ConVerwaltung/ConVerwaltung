import {
	isValidCustomValue,
	listParticipantFields,
	listPersonFields,
	type CustomFieldDefinition,
	type CustomValuedRecord
} from './custom-field';
import type { ImportDecision } from './import-match';
import type { ShapedRow } from './import-mapping';
import type { Library } from './library';
import { createParticipant, listParticipants, type Participant } from './participant';
import { createPerson, type Person } from './person';
import { listRoles } from './role';

export interface RejectedImportValue {
	readonly rowNumber: number;
	readonly fieldName: string;
	readonly value: string;
}

export interface ImportPlan {
	readonly newPersons: readonly Person[];
	/** Existing Persons a row was linked to, carrying the row's mapped values. */
	readonly linkedPersons: readonly Person[];
	readonly newParticipants: readonly Participant[];
	readonly updatedParticipants: readonly Participant[];
	/** Rows the organizer decided to skip, counted from 1. */
	readonly skippedRowNumbers: readonly number[];
	/** Rows that name no Person and cannot be decided, counted from 1. */
	readonly unnamedRowNumbers: readonly number[];
	readonly unknownRoleNames: readonly string[];
	readonly rejectedValues: readonly RejectedImportValue[];
}

interface ImportTargets {
	readonly eventId: string;
	readonly persons: Record<string, Person>;
	readonly participantsByPerson: ReadonlyMap<string, Participant>;
	readonly personFieldsById: ReadonlyMap<string, CustomFieldDefinition>;
	readonly participantFieldsByName: ReadonlyMap<string, CustomFieldDefinition>;
	readonly roleIdsByName: ReadonlyMap<string, string>;
}

function importTargets(library: Library, eventId: string): ImportTargets {
	const personFields = listPersonFields(library.customFields);
	const participantFields = listParticipantFields(library.customFields, eventId);
	const eventRoles = listRoles(library.roles, eventId);
	const eventParticipants = listParticipants(library.participants, eventId);
	return {
		eventId,
		persons: library.persons,
		participantsByPerson: new Map(
			eventParticipants.map((participant) => [participant.person, participant])
		),
		personFieldsById: new Map(personFields.map((field) => [field.id, field])),
		participantFieldsByName: new Map(participantFields.map((field) => [field.name, field])),
		roleIdsByName: new Map(eventRoles.map((role) => [role.name, role.id]))
	};
}

interface PlanDraft {
	readonly persons: Map<string, Person>;
	readonly participantsByPerson: Map<string, Participant>;
	readonly newPersonIds: Set<string>;
	readonly newParticipantIds: Set<string>;
	readonly skippedRowNumbers: number[];
	readonly unnamedRowNumbers: number[];
	readonly unknownRoleNames: string[];
	readonly rejectedValues: RejectedImportValue[];
}

function emptyDraft(): PlanDraft {
	return {
		persons: new Map(),
		participantsByPerson: new Map(),
		newPersonIds: new Set(),
		newParticipantIds: new Set(),
		skippedRowNumbers: [],
		unnamedRowNumbers: [],
		unknownRoleNames: [],
		rejectedValues: []
	};
}

interface ResolvedValues {
	readonly customValues: Record<string, string>;
	readonly rejectedValues: RejectedImportValue[];
}

// A cell that does not fit its Custom Field's type is left unwritten and
// reported; the rest of the row is still imported.
function resolveValues(
	values: Readonly<Record<string, string>>,
	definitions: ReadonlyMap<string, CustomFieldDefinition>,
	rowNumber: number
): ResolvedValues {
	const customValues: Record<string, string> = {};
	const rejectedValues: RejectedImportValue[] = [];
	for (const [key, value] of Object.entries(values)) {
		const definition = definitions.get(key);
		if (definition === undefined) {
			continue;
		}
		if (isValidCustomValue(definition, value)) {
			customValues[definition.id] = value;
		} else {
			rejectedValues.push({ rowNumber, fieldName: definition.name, value });
		}
	}
	return { customValues, rejectedValues };
}

interface ResolvedRoles {
	readonly roleIds: string[];
	readonly unknownRoleNames: string[];
}

// Roles stay an organizer decision: a name the Event does not define is
// reported back rather than defining a Role from file data.
function resolveRoles(
	roleNames: readonly string[],
	roleIdsByName: ReadonlyMap<string, string>
): ResolvedRoles {
	const roleIds: string[] = [];
	const unknownRoleNames: string[] = [];
	for (const roleName of roleNames) {
		const roleId = roleIdsByName.get(roleName);
		if (roleId === undefined) {
			unknownRoleNames.push(roleName);
		} else {
			roleIds.push(roleId);
		}
	}
	return { roleIds, unknownRoleNames };
}

interface RowValues {
	readonly personValues: Record<string, string>;
	readonly participantValues: Record<string, string>;
	readonly roleIds: readonly string[];
}

function resolveRow(
	draft: PlanDraft,
	targets: ImportTargets,
	row: ShapedRow,
	rowNumber: number
): RowValues {
	const personValues = resolveValues(row.personValues, targets.personFieldsById, rowNumber);
	const participantValues = resolveValues(
		row.participantValues,
		targets.participantFieldsByName,
		rowNumber
	);
	const resolvedRoles = resolveRoles(row.roleNames, targets.roleIdsByName);
	draft.rejectedValues.push(...personValues.rejectedValues, ...participantValues.rejectedValues);
	draft.unknownRoleNames.push(...resolvedRoles.unknownRoleNames);
	return {
		personValues: personValues.customValues,
		participantValues: participantValues.customValues,
		roleIds: resolvedRoles.roleIds
	};
}

function mergeCustomValues<T extends CustomValuedRecord>(
	record: T,
	customValues: Record<string, string>
): T {
	if (Object.keys(customValues).length === 0) {
		return record;
	}
	const merged = { ...record.customValues, ...customValues };
	return { ...record, customValues: merged };
}

// The file adds Roles to an existing Participant rather than replacing the ones
// the organizer already assigned.
function withRoles(participant: Participant, roleIds: readonly string[]): Participant {
	const roles = [...new Set([...participant.roles, ...roleIds])];
	return { ...participant, roles };
}

function addNewPerson(
	draft: PlanDraft,
	targets: ImportTargets,
	personName: string,
	values: RowValues
): void {
	const namedPerson = createPerson(personName);
	const person = mergeCustomValues(namedPerson, values.personValues);
	const rolledParticipant = createParticipant(targets.eventId, person.id, values.roleIds);
	const participant = mergeCustomValues(rolledParticipant, values.participantValues);
	draft.persons.set(person.id, person);
	draft.newPersonIds.add(person.id);
	draft.participantsByPerson.set(person.id, participant);
	draft.newParticipantIds.add(participant.id);
}

// Rows are applied one after another, so a second row for the same Person
// updates what the first one planned instead of duplicating it.
function linkExistingPerson(
	draft: PlanDraft,
	targets: ImportTargets,
	personId: string,
	values: RowValues
): void {
	const basePerson = draft.persons.get(personId) ?? targets.persons[personId];
	const person = mergeCustomValues(basePerson, values.personValues);
	draft.persons.set(personId, person);
	const baseParticipant =
		draft.participantsByPerson.get(personId) ?? targets.participantsByPerson.get(personId);
	if (baseParticipant === undefined) {
		const rolledParticipant = createParticipant(targets.eventId, personId, values.roleIds);
		const participant = mergeCustomValues(rolledParticipant, values.participantValues);
		draft.participantsByPerson.set(personId, participant);
		draft.newParticipantIds.add(participant.id);
		return;
	}
	const rolledParticipant = withRoles(baseParticipant, values.roleIds);
	const participant = mergeCustomValues(rolledParticipant, values.participantValues);
	draft.participantsByPerson.set(personId, participant);
}

function planRow(
	draft: PlanDraft,
	targets: ImportTargets,
	row: ShapedRow,
	rowNumber: number,
	decision: ImportDecision | undefined
): void {
	if (row.personName === '') {
		draft.unnamedRowNumbers.push(rowNumber);
		return;
	}
	if (decision === undefined) {
		throw new Error(`Row ${rowNumber} is still undecided`);
	}
	// A skipped row writes nothing at all, so its values are never resolved and
	// its Roles and unfitting values are not reported either.
	if (decision.kind === 'skip') {
		draft.skippedRowNumbers.push(rowNumber);
		return;
	}
	const values = resolveRow(draft, targets, row, rowNumber);
	if (decision.kind === 'new') {
		addNewPerson(draft, targets, row.personName, values);
	} else {
		linkExistingPerson(draft, targets, decision.personId, values);
	}
}

function collectPlan(draft: PlanDraft): ImportPlan {
	const persons = [...draft.persons.values()];
	const participants = [...draft.participantsByPerson.values()];
	return {
		newPersons: persons.filter((person) => draft.newPersonIds.has(person.id)),
		linkedPersons: persons.filter((person) => !draft.newPersonIds.has(person.id)),
		newParticipants: participants.filter((participant) =>
			draft.newParticipantIds.has(participant.id)
		),
		updatedParticipants: participants.filter(
			(participant) => !draft.newParticipantIds.has(participant.id)
		),
		skippedRowNumbers: draft.skippedRowNumbers,
		unnamedRowNumbers: draft.unnamedRowNumbers,
		unknownRoleNames: [...new Set(draft.unknownRoleNames)],
		rejectedValues: draft.rejectedValues
	};
}

/** Every named row needs a decision from the matching review before it commits. */
export function planImport(
	library: Library,
	eventId: string,
	rows: readonly ShapedRow[],
	decisions: ReadonlyMap<number, ImportDecision>
): ImportPlan {
	const targets = importTargets(library, eventId);
	const draft = emptyDraft();
	rows.forEach((row, index) => {
		const rowNumber = index + 1;
		const decision = decisions.get(rowNumber);
		planRow(draft, targets, row, rowNumber, decision);
	});
	return collectPlan(draft);
}
