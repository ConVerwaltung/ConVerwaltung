import type { CsvTable } from './csv';
import { customValueOf, type CustomFieldDefinition } from './custom-field';
import { newRecordId } from './ids';
import type { Library, LibraryRecord } from './library';
import { noteOf } from './note';
import { listParticipants, type Participant } from './participant';
import { listPersonsByName, type Person } from './person';
import { listRoles, type Role } from './role';

export type ExportLevel = 'person' | 'participant';

export type ColumnSource =
	| { readonly kind: 'personName' }
	| { readonly kind: 'personNote' }
	| { readonly kind: 'personField'; readonly definitionId: string }
	| { readonly kind: 'roles' }
	| { readonly kind: 'participantNote' }
	| { readonly kind: 'participantField'; readonly definitionId: string };

export interface ExportColumn {
	readonly source: ColumnSource;
	/** The heading this column carries in the output file. */
	readonly name: string;
}

export interface ExportView extends LibraryRecord {
	readonly name: string;
	readonly level: ExportLevel;
	/** Absent on Person-level views — they cover the whole Person pool. */
	readonly event?: string;
	readonly columns: readonly ExportColumn[];
}

export function isExportViewNameDefined(
	views: Record<string, ExportView>,
	level: ExportLevel,
	eventId: string | undefined,
	name: string
): boolean {
	const trimmedName = name.trim();
	return Object.values(views).some(
		(view) => view.level === level && view.event === eventId && view.name === trimmedName
	);
}

function normalizeViewName(
	views: Record<string, ExportView>,
	level: ExportLevel,
	eventId: string | undefined,
	name: string
): string {
	const trimmedName = name.trim();
	if (trimmedName === '') {
		throw new Error('Export View name must not be blank');
	}
	if (isExportViewNameDefined(views, level, eventId, trimmedName)) {
		throw new Error('Export View name is already defined');
	}
	return trimmedName;
}

// Output column names double as the header row, and a file with repeated
// headings cannot be read back in.
function normalizeColumns(columns: readonly ExportColumn[]): ExportColumn[] {
	const normalized = columns.map((column) => ({ source: column.source, name: column.name.trim() }));
	if (normalized.length === 0) {
		throw new Error('An Export View needs at least one column');
	}
	if (normalized.some((column) => column.name === '')) {
		throw new Error('Output column names must not be blank');
	}
	const distinctNames = new Set(normalized.map((column) => column.name));
	if (distinctNames.size !== normalized.length) {
		throw new Error('Output column names must be distinct');
	}
	return normalized;
}

export function defineExportView(
	views: Record<string, ExportView>,
	level: ExportLevel,
	eventId: string | undefined,
	name: string,
	columns: readonly ExportColumn[]
): ExportView {
	const viewName = normalizeViewName(views, level, eventId, name);
	const viewColumns = normalizeColumns(columns);
	return {
		id: newRecordId(),
		name: viewName,
		level,
		...(eventId === undefined ? {} : { event: eventId }),
		columns: viewColumns
	};
}

export function listExportViews(
	views: Record<string, ExportView>,
	level: ExportLevel,
	eventId: string | undefined
): ExportView[] {
	return Object.values(views)
		.filter((view) => view.level === level && view.event === eventId)
		.sort((a, b) => a.name.localeCompare(b.name));
}

function definitionIdOf(source: ColumnSource): string | undefined {
	if (source.kind === 'personField' || source.kind === 'participantField') {
		return source.definitionId;
	}
	return undefined;
}

/** Columns whose Custom Field has been removed since — they export as empty. */
export function unresolvedColumnNames(
	view: ExportView,
	definitions: Record<string, CustomFieldDefinition>
): string[] {
	const unresolved = view.columns.filter((column) => {
		const definitionId = definitionIdOf(column.source);
		return definitionId !== undefined && definitions[definitionId] === undefined;
	});
	return unresolved.map((column) => column.name);
}

const ROLE_SEPARATOR = ', ';

// Values are written in the same representation the Library stores them in, so
// a file read back through an Import Mapping validates against its field types.
function personCell(person: Person, source: ColumnSource): string {
	switch (source.kind) {
		case 'personName':
			return person.name;
		case 'personNote':
			return noteOf(person);
		case 'personField':
			return customValueOf(person, source.definitionId);
		default:
			return '';
	}
}

function participantCell(
	participant: Participant,
	person: Person,
	roleNames: readonly string[],
	source: ColumnSource
): string {
	switch (source.kind) {
		case 'roles':
			return roleNames.join(ROLE_SEPARATOR);
		case 'participantNote':
			return noteOf(participant);
		case 'participantField':
			return customValueOf(participant, source.definitionId);
		default:
			return personCell(person, source);
	}
}

function personRow(columns: readonly ExportColumn[], person: Person): string[] {
	return columns.map((column) => personCell(person, column.source));
}

function participantRow(
	columns: readonly ExportColumn[],
	participant: Participant,
	person: Person,
	eventRoles: readonly Role[]
): string[] {
	const assignedRoles = eventRoles.filter((role) => participant.roles.includes(role.id));
	const roleNames = assignedRoles.map((role) => role.name);
	return columns.map((column) => participantCell(participant, person, roleNames, column.source));
}

function personRows(library: Library, view: ExportView): string[][] {
	const persons = listPersonsByName(library.persons);
	return persons.map((person) => personRow(view.columns, person));
}

function participantRows(library: Library, view: ExportView): string[][] {
	const eventId = view.event ?? '';
	const participants = listParticipants(library.participants, eventId);
	const eventRoles = listRoles(library.roles, eventId);
	return participants.map((participant) => {
		const person = library.persons[participant.person];
		return participantRow(view.columns, participant, person, eventRoles);
	});
}

export function projectExportView(library: Library, view: ExportView): CsvTable {
	const columns = view.columns.map((column) => column.name);
	const rows = view.level === 'person' ? personRows(library, view) : participantRows(library, view);
	return { columns, rows };
}

export function exportFileName(view: ExportView): string {
	const slug = view.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
	return `${slug === '' ? 'Export-Ansicht' : slug}.csv`;
}
