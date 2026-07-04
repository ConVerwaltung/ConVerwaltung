import { newRecordId } from './ids';
import { compareByCreation, type LibraryRecord, type RecordKey } from './library';

export type CustomFieldLevel = 'person' | 'participant';

export const customFieldTypes = ['text', 'number', 'boolean', 'date', 'select'] as const;

export type CustomFieldType = (typeof customFieldTypes)[number];

export interface CustomFieldDefinition extends LibraryRecord {
	readonly level: CustomFieldLevel;
	readonly type: CustomFieldType;
	readonly name: string;
	/** Absent on Person-level definitions — they are global. */
	readonly event?: string;
	readonly selectOptions?: readonly string[];
}

export interface CustomValuedRecord extends LibraryRecord {
	/** Values by definition id; an absent entry means empty. */
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

export function isPersonFieldNameDefined(
	definitions: Record<string, CustomFieldDefinition>,
	name: string
): boolean {
	return isFieldNameDefined(definitions, 'person', undefined, name);
}

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

function dedupeTrimmed(options: readonly string[]): string[] {
	const trimmed = options.map((option) => option.trim()).filter((option) => option !== '');
	return [...new Set(trimmed)];
}

export function parseSelectOptions(text: string): string[] {
	return dedupeTrimmed(text.split('\n'));
}

function normalizeSelectOptions(options: readonly string[]): readonly string[] {
	const normalized = dedupeTrimmed(options);
	if (normalized.length === 0) {
		throw new Error('A single-select Custom Field needs at least one option');
	}
	return normalized;
}

function typeProperties(
	type: CustomFieldType,
	options: readonly string[]
): Pick<CustomFieldDefinition, 'type' | 'selectOptions'> {
	if (type === 'select') {
		return { type, selectOptions: normalizeSelectOptions(options) };
	}
	if (options.length > 0) {
		throw new Error('Only single-select Custom Fields have options');
	}
	return { type };
}

export function definePersonField(
	definitions: Record<string, CustomFieldDefinition>,
	name: string,
	type: CustomFieldType,
	options: readonly string[] = []
): CustomFieldDefinition {
	return {
		id: newRecordId(),
		level: 'person',
		name: normalizeFieldName(definitions, 'person', undefined, name),
		...typeProperties(type, options)
	};
}

export function defineParticipantField(
	definitions: Record<string, CustomFieldDefinition>,
	eventId: string,
	name: string,
	type: CustomFieldType,
	options: readonly string[] = []
): CustomFieldDefinition {
	return {
		id: newRecordId(),
		level: 'participant',
		event: eventId,
		name: normalizeFieldName(definitions, 'participant', eventId, name),
		...typeProperties(type, options)
	};
}

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

export function changeCustomFieldType<T extends CustomValuedRecord>(
	records: Record<string, T>,
	definition: CustomFieldDefinition,
	type: CustomFieldType,
	options: readonly string[] = []
): CustomFieldDefinition {
	if (countCustomValues(records, definition.id) > 0) {
		throw new Error('Cannot change the type of a Custom Field with recorded values');
	}
	return {
		id: definition.id,
		level: definition.level,
		name: definition.name,
		...(definition.event === undefined ? {} : { event: definition.event }),
		...typeProperties(type, options)
	};
}

export function editSelectOptions<T extends CustomValuedRecord>(
	records: Record<string, T>,
	definition: CustomFieldDefinition,
	options: readonly string[]
): CustomFieldDefinition {
	if (definition.type !== 'select') {
		throw new Error('Only single-select Custom Fields have options');
	}
	const normalized = normalizeSelectOptions(options);
	const stillUsed = listUsedCustomValues(records, definition.id).filter(
		(value) => !normalized.includes(value)
	);
	if (stillUsed.length > 0) {
		throw new Error(`Options still recorded as values cannot be removed: ${stillUsed.join(', ')}`);
	}
	return { ...definition, selectOptions: normalized };
}

export function listPersonFields(
	definitions: Record<string, CustomFieldDefinition>
): CustomFieldDefinition[] {
	return Object.values(definitions)
		.filter((definition) => definition.level === 'person')
		.sort(compareByCreation);
}

export function listParticipantFields(
	definitions: Record<string, CustomFieldDefinition>,
	eventId: string
): CustomFieldDefinition[] {
	return Object.values(definitions)
		.filter((definition) => definition.level === 'participant' && definition.event === eventId)
		.sort(compareByCreation);
}

function isIsoCalendarDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isValidCustomValue(definition: CustomFieldDefinition, value: string): boolean {
	if (value === '') {
		return true;
	}
	switch (definition.type) {
		case 'text':
			return true;
		case 'number':
			return value.trim() !== '' && Number.isFinite(Number(value));
		case 'boolean':
			return value === 'true' || value === 'false';
		case 'date':
			return isIsoCalendarDate(value);
		case 'select':
			return definition.selectOptions !== undefined && definition.selectOptions.includes(value);
	}
}

export function customValueOf(record: CustomValuedRecord, definitionId: string): string {
	return record.customValues?.[definitionId] ?? '';
}

function setCustomValue<T extends CustomValuedRecord>(
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

export function editCustomValue<T extends CustomValuedRecord>(
	record: T,
	definition: CustomFieldDefinition,
	value: string
): T {
	if (!isValidCustomValue(definition, value)) {
		throw new Error(`Value does not fit the ${definition.type} Custom Field “${definition.name}”`);
	}
	return setCustomValue(record, definition.id, value);
}

export function countCustomValues<T extends CustomValuedRecord>(
	records: Record<string, T>,
	definitionId: string
): number {
	return Object.values(records).filter(
		(record) => record.customValues?.[definitionId] !== undefined
	).length;
}

export function listUsedCustomValues<T extends CustomValuedRecord>(
	records: Record<string, T>,
	definitionId: string
): string[] {
	const values = Object.values(records)
		.map((record) => record.customValues?.[definitionId])
		.filter((value): value is string => value !== undefined);
	return [...new Set(values)].sort();
}

export function removeCustomFieldDefinition<T extends CustomValuedRecord>(
	records: Record<string, T>,
	definitionId: string
): { deletions: RecordKey[]; clearedRecords: T[] } {
	const clearedRecords = Object.values(records)
		.filter((record) => record.customValues?.[definitionId] !== undefined)
		.map((record) => setCustomValue(record, definitionId, ''));
	return { deletions: [{ section: 'customFields', id: definitionId }], clearedRecords };
}
