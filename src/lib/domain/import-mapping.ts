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

/**
 * The identity columns the file has, in file order — the chain the Person name
 * is joined from (`Vorname` + `Nachname`).
 */
export function identityChainOf(
	columns: Readonly<Record<string, ColumnTarget>>,
	fileColumns: readonly string[]
): string[] {
	const identityColumns = new Set(identityColumnsOf(columns));
	return fileColumns.filter((column) => identityColumns.has(column));
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
	if (identityColumnsOf(columns).length === 0) {
		throw new Error('At least one column must be a Person-identity column');
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

// Files split the name over as many columns as they like ("Vorname",
// "Nachname"); the identity columns are joined in file order, so the reading
// order of the file is the reading order of the name.
function identityName(row: readonly string[], identityIndices: readonly number[]): string {
	return identityIndices
		.map((index) => (row[index] ?? '').trim())
		.filter((part) => part !== '')
		.join(' ');
}

function identityIndicesOf(
	columns: Readonly<Record<string, ColumnTarget>>,
	indexByColumn: ReadonlyMap<string, number>
): number[] {
	const identityColumns = new Set(identityColumnsOf(columns));
	return [...indexByColumn]
		.filter(([column]) => identityColumns.has(column))
		.map(([, index]) => index);
}

function shapeRow(
	row: readonly string[],
	columns: Readonly<Record<string, ColumnTarget>>,
	indexByColumn: ReadonlyMap<string, number>,
	identityIndices: readonly number[]
): ShapedRow {
	const personName = identityName(row, identityIndices);
	const personValues: Record<string, string> = {};
	const participantValues: Record<string, string> = {};
	const roleNames: string[] = [];
	for (const [column, target] of Object.entries(columns)) {
		const index = indexByColumn.get(column);
		if (index === undefined || target.kind === 'identity') {
			continue;
		}
		const value = (row[index] ?? '').trim();
		if (value === '') {
			continue;
		}
		if (target.kind === 'personField') {
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
// nothing matched or committed. Mapped columns the file lacks are skipped, but
// at least one identity column must be there, without which rows cannot name a
// Person.
export function shapeRows(
	table: CsvTable,
	columns: Readonly<Record<string, ColumnTarget>>
): ShapedRow[] {
	const indexByColumn = new Map(table.columns.map((column, index) => [column, index]));
	const identityIndices = identityIndicesOf(columns, indexByColumn);
	if (identityIndices.length === 0) {
		throw new Error('The Person-identity column is missing from the file');
	}
	return table.rows.map((row) => shapeRow(row, columns, indexByColumn, identityIndices));
}
