import {
	isValidCustomValue,
	listParticipantFields,
	listPersonFields,
	type CustomFieldDefinition,
	type CustomValuedRecord
} from './custom-field';
import type { ShapedRow } from './import-mapping';
import { createParticipant, type Participant } from './participant';
import { createPerson, type Person } from './person';
import { listRoles, type Role } from './role';

export interface RejectedImportValue {
	readonly rowNumber: number;
	readonly fieldName: string;
	readonly value: string;
}

export interface ImportPlan {
	readonly persons: readonly Person[];
	readonly participants: readonly Participant[];
	/** Positions among the file's data rows, counted from 1. */
	readonly skippedRowNumbers: readonly number[];
	readonly unknownRoleNames: readonly string[];
	readonly rejectedValues: readonly RejectedImportValue[];
}

interface ImportTargets {
	readonly eventId: string;
	readonly personFieldsById: ReadonlyMap<string, CustomFieldDefinition>;
	readonly participantFieldsByName: ReadonlyMap<string, CustomFieldDefinition>;
	readonly roleIdsByName: ReadonlyMap<string, string>;
}

interface SkippedRow {
	readonly kind: 'skipped';
	readonly rowNumber: number;
}

interface CommittedRow {
	readonly kind: 'committed';
	readonly person: Person;
	readonly participant: Participant;
	readonly unknownRoleNames: readonly string[];
	readonly rejectedValues: readonly RejectedImportValue[];
}

type PlannedRow = SkippedRow | CommittedRow;

function importTargets(
	customFields: Record<string, CustomFieldDefinition>,
	roles: Record<string, Role>,
	eventId: string
): ImportTargets {
	const personFields = listPersonFields(customFields);
	const participantFields = listParticipantFields(customFields, eventId);
	const eventRoles = listRoles(roles, eventId);
	return {
		eventId,
		personFieldsById: new Map(personFields.map((field) => [field.id, field])),
		participantFieldsByName: new Map(participantFields.map((field) => [field.name, field])),
		roleIdsByName: new Map(eventRoles.map((role) => [role.name, role.id]))
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

function withCustomValues<T extends CustomValuedRecord>(
	record: T,
	customValues: Record<string, string>
): T {
	if (Object.keys(customValues).length === 0) {
		return record;
	}
	return { ...record, customValues };
}

function planRow(targets: ImportTargets, row: ShapedRow, rowNumber: number): PlannedRow {
	if (row.personName === '') {
		return { kind: 'skipped', rowNumber };
	}
	const personValues = resolveValues(row.personValues, targets.personFieldsById, rowNumber);
	const participantValues = resolveValues(
		row.participantValues,
		targets.participantFieldsByName,
		rowNumber
	);
	const resolvedRoles = resolveRoles(row.roleNames, targets.roleIdsByName);
	const namedPerson = createPerson(row.personName);
	const person = withCustomValues(namedPerson, personValues.customValues);
	const rolledParticipant = createParticipant(targets.eventId, person.id, resolvedRoles.roleIds);
	const participant = withCustomValues(rolledParticipant, participantValues.customValues);
	return {
		kind: 'committed',
		person,
		participant,
		unknownRoleNames: resolvedRoles.unknownRoleNames,
		rejectedValues: [...personValues.rejectedValues, ...participantValues.rejectedValues]
	};
}

function isCommitted(row: PlannedRow): row is CommittedRow {
	return row.kind === 'committed';
}

function isSkipped(row: PlannedRow): row is SkippedRow {
	return row.kind === 'skipped';
}

function collectPlan(plannedRows: readonly PlannedRow[]): ImportPlan {
	const committedRows = plannedRows.filter(isCommitted);
	const unknownRoleNames = committedRows.flatMap((row) => row.unknownRoleNames);
	const skippedRows = plannedRows.filter(isSkipped);
	return {
		persons: committedRows.map((row) => row.person),
		participants: committedRows.map((row) => row.participant),
		skippedRowNumbers: skippedRows.map((row) => row.rowNumber),
		unknownRoleNames: [...new Set(unknownRoleNames)],
		rejectedValues: committedRows.flatMap((row) => row.rejectedValues)
	};
}

// Every row yields a fresh Person: recognizing returning Persons is the
// interactive matching phase, which does not exist yet.
export function planImport(
	customFields: Record<string, CustomFieldDefinition>,
	roles: Record<string, Role>,
	eventId: string,
	rows: readonly ShapedRow[]
): ImportPlan {
	const targets = importTargets(customFields, roles, eventId);
	const plannedRows = rows.map((row, index) => planRow(targets, row, index + 1));
	return collectPlan(plannedRows);
}
