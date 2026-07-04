// Custom Field (CONTEXT.md): an organizer-defined, named and typed data slot. Values
// are recorded against the definition per record. Person-level definitions are global —
// they apply to every Person across all Events; Participant-level definitions belong to
// one Event and apply only to its Participants. Names are unique within their scope:
// across all Person-level fields, and per Event among its Participant-level fields.
// Framework-free — no `svelte` imports.
import { newRecordId } from './ids';
import type { LibraryRecord, RecordKey } from './library';

/** Person-level fields are global; Participant-level fields are per Event. */
export type CustomFieldLevel = 'person' | 'participant';

export type CustomFieldType = 'text';

export interface CustomFieldDefinition extends LibraryRecord {
	readonly level: CustomFieldLevel;
	readonly type: CustomFieldType;
	readonly name: string;
	/** The Event a Participant-level definition belongs to; absent on Person-level (global). */
	readonly event?: string;
}

/** A record carrying Custom Field values, indexed by definition id. Absent means empty. */
export interface CustomValuedRecord extends LibraryRecord {
	readonly customValues?: Readonly<Record<string, string>>;
}

function isFieldNameDefined(
	definitions: Record<string, CustomFieldDefinition>,
	level: CustomFieldLevel,
	eventId: string | undefined,
	name: string
): boolean {
	const trimmedName = name.trim();
	return Object.values(definitions).some(
		(definition) =>
			definition.level === level && definition.event === eventId && definition.name === trimmedName
	);
}

/** Whether a Person-level Custom Field with this name (after trimming) is defined. */
export function isPersonFieldNameDefined(
	definitions: Record<string, CustomFieldDefinition>,
	name: string
): boolean {
	return isFieldNameDefined(definitions, 'person', undefined, name);
}

/** Whether the Event defines a Participant-level Custom Field with this name (after trimming). */
export function isParticipantFieldNameDefined(
	definitions: Record<string, CustomFieldDefinition>,
	eventId: string,
	name: string
): boolean {
	return isFieldNameDefined(definitions, 'participant', eventId, name);
}

function normalizeFieldName(
	definitions: Record<string, CustomFieldDefinition>,
	level: CustomFieldLevel,
	eventId: string | undefined,
	name: string
): string {
	const trimmedName = name.trim();
	if (trimmedName === '') {
		throw new Error('Custom Field name must not be blank');
	}
	if (isFieldNameDefined(definitions, level, eventId, trimmedName)) {
		throw new Error('Custom Field name is already defined');
	}
	return trimmedName;
}

/** Define a global Person-level text Custom Field. Blank and duplicate names are rejected. */
export function definePersonTextField(
	definitions: Record<string, CustomFieldDefinition>,
	name: string
): CustomFieldDefinition {
	return {
		id: newRecordId(),
		level: 'person',
		type: 'text',
		name: normalizeFieldName(definitions, 'person', undefined, name)
	};
}

/**
 * Define a Participant-level text Custom Field within an Event. Blank names and names
 * already used by this Event's Participant-level fields are rejected.
 */
export function defineParticipantTextField(
	definitions: Record<string, CustomFieldDefinition>,
	eventId: string,
	name: string
): CustomFieldDefinition {
	return {
		id: newRecordId(),
		level: 'participant',
		type: 'text',
		event: eventId,
		name: normalizeFieldName(definitions, 'participant', eventId, name)
	};
}

/** Rename a Custom Field. Blank names and duplicates within its scope are rejected. */
export function renameCustomField(
	definitions: Record<string, CustomFieldDefinition>,
	definition: CustomFieldDefinition,
	name: string
): CustomFieldDefinition {
	const otherDefinitions = Object.fromEntries(
		Object.entries(definitions).filter(([id]) => id !== definition.id)
	);
	return {
		...definition,
		name: normalizeFieldName(otherDefinitions, definition.level, definition.event, name)
	};
}

/** The Person-level Custom Fields in creation order — UUID v7 keys sort chronologically. */
export function listPersonFields(
	definitions: Record<string, CustomFieldDefinition>
): CustomFieldDefinition[] {
	return Object.values(definitions)
		.filter((definition) => definition.level === 'person')
		.sort((a, b) => a.id.localeCompare(b.id));
}

/** One Event's Participant-level Custom Fields in creation order. */
export function listParticipantFields(
	definitions: Record<string, CustomFieldDefinition>,
	eventId: string
): CustomFieldDefinition[] {
	return Object.values(definitions)
		.filter((definition) => definition.level === 'participant' && definition.event === eventId)
		.sort((a, b) => a.id.localeCompare(b.id));
}

/** The record's value for a Custom Field; absent means empty. */
export function customValueOf(record: CustomValuedRecord, definitionId: string): string {
	return record.customValues?.[definitionId] ?? '';
}

/** Record a value against a Custom Field definition. Empty text clears the value. */
export function editCustomValue<T extends CustomValuedRecord>(
	record: T,
	definitionId: string,
	value: string
): T {
	const customValues = { ...record.customValues };
	if (value === '') {
		delete customValues[definitionId];
	} else {
		customValues[definitionId] = value;
	}
	return { ...record, customValues };
}

/**
 * Removing a Custom Field definition cascades to its recorded values: the definition is
 * deleted and every record carrying a value for it loses that value. The UI states this
 * in its confirmation before committing. Returns the record to delete plus the cleared
 * records to write back.
 */
export function removeCustomFieldDefinition<T extends CustomValuedRecord>(
	records: Record<string, T>,
	definitionId: string
): { deletions: RecordKey[]; clearedRecords: T[] } {
	const clearedRecords = Object.values(records)
		.filter((record) => record.customValues?.[definitionId] !== undefined)
		.map((record) => editCustomValue(record, definitionId, ''));
	return { deletions: [{ section: 'customFields', id: definitionId }], clearedRecords };
}
