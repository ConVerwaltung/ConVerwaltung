import type { CsvTable } from './csv';
import { newRecordId } from './ids';
import type { LibraryRecord } from './library';

// Person-level definitions are global, so their id is the stable reference.
// Participant-level definitions are per Event while the Mapping is reused
// across Events, so the field name is the only handle that travels; it is
// resolved against the target Event's definitions when the Import commits.
export type ColumnTarget =
	| { readonly kind: 'identity' }
	| { readonly kind: 'personField'; readonly definitionId: string }
	| { readonly kind: 'participantField'; readonly fieldName: string }
	| { readonly kind: 'role' };

export interface ImportMapping extends LibraryRecord {
	readonly name: string;
	/** Targets by source column name; a column without an entry is ignored. */
	readonly columns: Readonly<Record<string, ColumnTarget>>;
}

export function identityColumnsOf(columns: Readonly<Record<string, ColumnTarget>>): string[] {
	return Object.entries(columns)
		.filter(([, target]) => target.kind === 'identity')
		.map(([column]) => column);
}

export function isImportMappingNameDefined(
	mappings: Record<string, ImportMapping>,
	name: string
): boolean {
	const trimmedName = name.trim();
	return Object.values(mappings).some((mapping) => mapping.name === trimmedName);
}

export function defineImportMapping(
	mappings: Record<string, ImportMapping>,
	name: string,
	columns: Readonly<Record<string, ColumnTarget>>
): ImportMapping {
	const trimmedName = name.trim();
	if (trimmedName === '') {
		throw new Error('Import Mapping name must not be blank');
	}
	if (isImportMappingNameDefined(mappings, trimmedName)) {
		throw new Error('Import Mapping name is already defined');
	}
	if (identityColumnsOf(columns).length !== 1) {
		throw new Error('Exactly one column must be the Person-identity column');
	}
	return { id: newRecordId(), name: trimmedName, columns };
}

export function listImportMappingsByName(
	mappings: Record<string, ImportMapping>
): ImportMapping[] {
	return Object.values(mappings).sort((a, b) => a.name.localeCompare(b.name));
}

/** Mapped columns the file does not have — a Mapping reused on a different file shape. */
export function missingMappedColumns(
	mapping: ImportMapping,
	fileColumns: readonly string[]
): string[] {
	return Object.keys(mapping.columns).filter((column) => !fileColumns.includes(column));
}

export interface ShapedRow {
	readonly personName: string;
	/** Values by Person-level definition id; empty cells are omitted. */
	readonly personValues: Readonly<Record<string, string>>;
	/** Values by Participant-level field name; empty cells are omitted. */
	readonly participantValues: Readonly<Record<string, string>>;
	readonly roleNames: readonly string[];
}

function shapeRow(
	row: readonly string[],
	columns: Readonly<Record<string, ColumnTarget>>,
	indexByColumn: ReadonlyMap<string, number>
): ShapedRow {
	let personName = '';
	const personValues: Record<string, string> = {};
	const participantValues: Record<string, string> = {};
	const roleNames: string[] = [];
	for (const [column, target] of Object.entries(columns)) {
		const index = indexByColumn.get(column);
		if (index === undefined) {
			continue;
		}
		const value = (row[index] ?? '').trim();
		if (target.kind === 'identity') {
			personName = value;
		} else if (value === '') {
			continue;
		} else if (target.kind === 'personField') {
			personValues[target.definitionId] = value;
		} else if (target.kind === 'participantField') {
			participantValues[target.fieldName] = value;
		} else if (!roleNames.includes(value)) {
			roleNames.push(value);
		}
	}
	return { personName, personValues, participantValues, roleNames };
}

// The parse-phase output (ADR-0001): rows restated as their mapped targets,
// nothing matched or committed. Mapped columns the file lacks are skipped,
// except the identity column, without which rows cannot name a Person.
export function shapeRows(
	table: CsvTable,
	columns: Readonly<Record<string, ColumnTarget>>
): ShapedRow[] {
	const indexByColumn = new Map(table.columns.map((column, index) => [column, index]));
	const identityPresent = identityColumnsOf(columns).some((column) => indexByColumn.has(column));
	if (!identityPresent) {
		throw new Error('The Person-identity column is missing from the file');
	}
	return table.rows.map((row) => shapeRow(row, columns, indexByColumn));
}
