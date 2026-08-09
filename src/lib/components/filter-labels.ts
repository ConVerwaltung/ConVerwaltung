import type { CustomFieldDefinition } from '$lib/domain/custom-field';
import type { FilterCondition, ValueTest } from '$lib/domain/export-filter';
import type { Role } from '$lib/domain/role';

const REMOVED_FIELD_NAME = 'Entferntes Feld';
const REMOVED_ROLE_NAME = 'Entfernte Rolle';

export function customValueLabel(
	definition: CustomFieldDefinition | undefined,
	value: string
): string {
	if (definition?.type === 'boolean') {
		return value === 'true' ? 'ja' : 'nein';
	}
	return value;
}

function testLabel(definition: CustomFieldDefinition | undefined, test: ValueTest): string {
	switch (test.kind) {
		case 'equals':
			return `ist „${customValueLabel(definition, test.value)}“`;
		case 'empty':
			return 'ist leer';
		case 'notEmpty':
			return 'ist ausgefüllt';
	}
}

function roleLabel(roles: Record<string, Role>, roleId: string, holds: boolean): string {
	const roleName = roles[roleId]?.name ?? REMOVED_ROLE_NAME;
	return holds ? `hält Rolle „${roleName}“` : `hält Rolle „${roleName}“ nicht`;
}

function fieldLabel(
	definitions: Record<string, CustomFieldDefinition>,
	definitionId: string,
	test: ValueTest
): string {
	const definition = definitions[definitionId];
	const fieldName = definition?.name ?? REMOVED_FIELD_NAME;
	return `${fieldName} ${testLabel(definition, test)}`;
}

export function conditionLabel(
	condition: FilterCondition,
	definitions: Record<string, CustomFieldDefinition>,
	roles: Record<string, Role>
): string {
	if (condition.kind === 'role') {
		return roleLabel(roles, condition.roleId, condition.holds);
	}
	return fieldLabel(definitions, condition.definitionId, condition.test);
}
