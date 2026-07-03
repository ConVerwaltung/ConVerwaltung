// Custom Field (CONTEXT.md): an organizer-defined, named and typed data slot. Values
// are recorded against the definition per record. The definition model already carries
// a level and a type so follow-up slices extend naturally, but this slice only creates
// Person-level text fields: Person-level definitions are global — they apply to every
// Person across all Events. Framework-free — no `svelte` imports.
import { newRecordId } from './ids';
import type { LibraryRecord, RecordKey } from './library';

/** Person-level fields are global; Participant-level fields (later slice) are per Event. */
export type CustomFieldLevel = 'person' | 'participant';

export type CustomFieldType = 'text';

export interface CustomFieldDefinition extends LibraryRecord {
	readonly level: CustomFieldLevel;
	readonly type: CustomFieldType;
	readonly name: string;
}

/** A record carrying Custom Field values, indexed by definition id. Absent means empty. */
export interface CustomValuedRecord extends LibraryRecord {
	readonly customValues?: Readonly<Record<string, string>>;
}

/** Whether a Person-level Custom Field with this name (after trimming) is defined. */
export function isPersonFieldNameDefined(
	definitions: Record<string, CustomFieldDefinition>,
	name: string
): boolean {
	const trimmedName = name.trim();
	return Object.values(definitions).some(
		(definition) => definition.level === 'person' && definition.name === trimmedName
	);
}

function normalizePersonFieldName(
	definitions: Record<string, CustomFieldDefinition>,
	name: string
): string {
	const trimmedName = name.trim();
	if (trimmedName === '') {
		throw new Error('Custom Field name must not be blank');
	}
	if (isPersonFieldNameDefined(definitions, trimmedName)) {
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
		name: normalizePersonFieldName(definitions, name)
	};
}

/** Rename a Custom Field. Blank names and duplicates within its level are rejected. */
export function renameCustomField(
	definitions: Record<string, CustomFieldDefinition>,
	definition: CustomFieldDefinition,
	name: string
): CustomFieldDefinition {
	const otherDefinitions = Object.fromEntries(
		Object.entries(definitions).filter(([id]) => id !== definition.id)
	);
	return { ...definition, name: normalizePersonFieldName(otherDefinitions, name) };
}

/** The Person-level Custom Fields in creation order — UUID v7 keys sort chronologically. */
export function listPersonFields(
	definitions: Record<string, CustomFieldDefinition>
): CustomFieldDefinition[] {
	return Object.values(definitions)
		.filter((definition) => definition.level === 'person')
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
