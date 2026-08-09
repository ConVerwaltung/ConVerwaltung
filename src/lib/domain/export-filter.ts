import { customValueOf, type CustomFieldDefinition, type CustomFieldType } from './custom-field';
import type { Participant } from './participant';
import type { Person } from './person';

export type ValueTest =
	| { readonly kind: 'equals'; readonly value: string }
	| { readonly kind: 'empty' }
	| { readonly kind: 'notEmpty' };

export type FilterCondition =
	| { readonly kind: 'role'; readonly roleId: string; readonly holds: boolean }
	| { readonly kind: 'field'; readonly definitionId: string; readonly test: ValueTest };

export interface FilteredRecord {
	readonly person: Person;
	/** Absent on Person-level records — they take part in no single Event. */
	readonly participant?: Participant;
}

function normalizeCondition(condition: FilterCondition): FilterCondition {
	if (condition.kind !== 'field' || condition.test.kind !== 'equals') {
		return condition;
	}
	const value = condition.test.value.trim();
	if (value === '') {
		throw new Error('A comparison value must not be blank — compare against empty instead');
	}
	return { kind: 'field', definitionId: condition.definitionId, test: { kind: 'equals', value } };
}

export function normalizeFilter(conditions: readonly FilterCondition[]): FilterCondition[] {
	return conditions.map(normalizeCondition);
}

// Values are stored as strings, so only the types whose strings can differ while
// the value is the same need more than an exact comparison.
function equalsRecordedValue(type: CustomFieldType, recorded: string, wanted: string): boolean {
	if (recorded === '') {
		return false;
	}
	if (type === 'number') {
		return Number(recorded) === Number(wanted);
	}
	if (type === 'text') {
		return recorded.localeCompare(wanted, undefined, { sensitivity: 'accent' }) === 0;
	}
	return recorded === wanted;
}

function testRecordedValue(test: ValueTest, type: CustomFieldType, recorded: string): boolean {
	switch (test.kind) {
		case 'equals':
			return equalsRecordedValue(type, recorded, test.value);
		case 'empty':
			return recorded === '';
		case 'notEmpty':
			return recorded !== '';
	}
}

function recordedValueOf(record: FilteredRecord, definition: CustomFieldDefinition): string {
	if (definition.level === 'person') {
		return customValueOf(record.person, definition.id);
	}
	return record.participant === undefined ? '' : customValueOf(record.participant, definition.id);
}

function matchesRole(record: FilteredRecord, roleId: string, holds: boolean): boolean {
	const roleHeld = record.participant?.roles.includes(roleId) ?? false;
	return roleHeld === holds;
}

// A Custom Field removed since the filter was defined leaves its values nowhere.
function matchesField(
	record: FilteredRecord,
	definition: CustomFieldDefinition | undefined,
	test: ValueTest
): boolean {
	if (definition === undefined) {
		return testRecordedValue(test, 'text', '');
	}
	const recorded = recordedValueOf(record, definition);
	return testRecordedValue(test, definition.type, recorded);
}

function matchesCondition(
	condition: FilterCondition,
	definitions: Record<string, CustomFieldDefinition>,
	record: FilteredRecord
): boolean {
	if (condition.kind === 'role') {
		return matchesRole(record, condition.roleId, condition.holds);
	}
	return matchesField(record, definitions[condition.definitionId], condition.test);
}

export function matchesFilter(
	conditions: readonly FilterCondition[],
	definitions: Record<string, CustomFieldDefinition>,
	record: FilteredRecord
): boolean {
	return conditions.every((condition) => matchesCondition(condition, definitions, record));
}
