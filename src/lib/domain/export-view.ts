import type { CsvTable } from './csv';
import {
	customValueOf,
	listParticipantFields,
	type CustomFieldDefinition
} from './custom-field';
import { matchesFilter, normalizeFilter, type FilterCondition } from './export-filter';
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
	/** Absent when the view covers every record of its level. */
	readonly filter?: readonly FilterCondition[];
	readonly columns: readonly ExportColumn[];
}

export function filterOf(view: ExportView): readonly FilterCondition[] {
	return view.filter ?? [];
}

export function isExportViewNameDefined(
	views: Record<string, ExportView>,
	level: ExportLevel,
	eventId: string | undefined,
	name: string,
	exceptViewId?: string
): boolean {
	const trimmedName = name.trim();
	return Object.values(views).some(
		(view) =>
			view.id !== exceptViewId
			&& view.level === level
			&& view.event === eventId
			&& view.name === trimmedName
	);
}

function normalizeViewName(
	views: Record<string, ExportView>,
	level: ExportLevel,
	eventId: string | undefined,
	name: string,
	exceptViewId?: string
): string {
	const trimmedName = name.trim();
	if (trimmedName === '') {
		throw new Error('Export View name must not be blank');
	}
	if (isExportViewNameDefined(views, level, eventId, trimmedName, exceptViewId)) {
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

function buildExportView(
	id: string,
	name: string,
	level: ExportLevel,
	eventId: string | undefined,
	filter: readonly FilterCondition[],
	columns: readonly ExportColumn[]
): ExportView {
	return {
		id,
		name,
		level,
		...(eventId === undefined ? {} : { event: eventId }),
		...(filter.length === 0 ? {} : { filter }),
		columns
	};
}

export function defineExportView(
	views: Record<string, ExportView>,
	level: ExportLevel,
	eventId: string | undefined,
	name: string,
	filter: readonly FilterCondition[],
	columns: readonly ExportColumn[]
): ExportView {
	const viewName = normalizeViewName(views, level, eventId, name);
	const viewFilter = normalizeFilter(filter);
	const viewColumns = normalizeColumns(columns);
	return buildExportView(newRecordId(), viewName, level, eventId, viewFilter, viewColumns);
}

export function renameExportView(
	views: Record<string, ExportView>,
	view: ExportView,
	name: string
): ExportView {
	const viewName = normalizeViewName(views, view.level, view.event, name, view.id);
	return { ...view, name: viewName };
}

export function updateExportViewColumns(
	view: ExportView,
	columns: readonly ExportColumn[]
): ExportView {
	return { ...view, columns: normalizeColumns(columns) };
}

// A duplicate is a record of its own, and a name is what tells two Ansichten apart in
// their register — so the copy is named before it exists, never after.
function freeCopyName(views: Record<string, ExportView>, view: ExportView): string {
	const base = `${view.name} (Kopie)`;
	let candidate = base;
	let attempt = 1;
	while (isExportViewNameDefined(views, view.level, view.event, candidate)) {
		attempt += 1;
		candidate = `${base} ${attempt}`;
	}
	return candidate;
}

export function duplicateExportView(
	views: Record<string, ExportView>,
	view: ExportView
): ExportView {
	return buildExportView(
		newRecordId(),
		freeCopyName(views, view),
		view.level,
		view.event,
		filterOf(view),
		view.columns
	);
}

export function updateExportViewFilter(
	view: ExportView,
	filter: readonly FilterCondition[]
): ExportView {
	const conditions = normalizeFilter(filter);
	return buildExportView(view.id, view.name, view.level, view.event, conditions, view.columns);
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

function isColumnResolved(
	view: ExportView,
	definitions: Record<string, CustomFieldDefinition>,
	source: ColumnSource
): boolean {
	const definitionId = definitionIdOf(source);
	if (definitionId === undefined) {
		return true;
	}
	const definition = definitions[definitionId];
	if (definition === undefined) {
		return false;
	}
	return definition.level === 'person' || definition.event === view.event;
}

/** Columns whose Custom Field is gone or belongs to another Event — they export as empty. */
export function unresolvedColumnNames(
	view: ExportView,
	definitions: Record<string, CustomFieldDefinition>
): string[] {
	const unresolved = view.columns.filter(
		(column) => !isColumnResolved(view, definitions, column.source)
	);
	return unresolved.map((column) => column.name);
}

export type UnmatchedPart =
	| { readonly kind: 'column'; readonly column: ExportColumn }
	| { readonly kind: 'condition'; readonly condition: FilterCondition };

export interface ExportViewCopy {
	readonly view: ExportView;
	/** Parts without a counterpart: the columns kept empty, the conditions dropped. */
	readonly unmatched: readonly UnmatchedPart[];
}

interface CopiedColumns {
	readonly columns: ExportColumn[];
	readonly unmatched: UnmatchedPart[];
}

interface CopiedFilter {
	readonly conditions: FilterCondition[];
	readonly unmatched: UnmatchedPart[];
}

// Ids are per-Event, so a Teilnehmer-Feld carries over only by its name.
function matchedFieldId(
	definitions: Record<string, CustomFieldDefinition>,
	definitionId: string,
	targetFields: readonly CustomFieldDefinition[]
): string | undefined {
	const definition = definitions[definitionId];
	if (definition === undefined) {
		return undefined;
	}
	const match = targetFields.find((field) => field.name === definition.name);
	return match?.id;
}

function matchedRoleId(
	roles: Record<string, Role>,
	roleId: string,
	targetRoles: readonly Role[]
): string | undefined {
	const role = roles[roleId];
	if (role === undefined) {
		return undefined;
	}
	const match = targetRoles.find((entry) => entry.name === role.name);
	return match?.id;
}

function copyColumns(
	columns: readonly ExportColumn[],
	definitions: Record<string, CustomFieldDefinition>,
	targetFields: readonly CustomFieldDefinition[]
): CopiedColumns {
	const copied: ExportColumn[] = [];
	const unmatched: UnmatchedPart[] = [];
	for (const column of columns) {
		const source = column.source;
		if (source.kind !== 'participantField') {
			copied.push(column);
			continue;
		}
		const definitionId = matchedFieldId(definitions, source.definitionId, targetFields);
		if (definitionId === undefined) {
			copied.push(column);
			unmatched.push({ kind: 'column', column });
			continue;
		}
		copied.push({ source: { kind: 'participantField', definitionId }, name: column.name });
	}
	return { columns: copied, unmatched };
}

function copiedCondition(
	condition: FilterCondition,
	library: Library,
	targetFields: readonly CustomFieldDefinition[],
	targetRoles: readonly Role[]
): FilterCondition | undefined {
	if (condition.kind === 'role') {
		const roleId = matchedRoleId(library.roles, condition.roleId, targetRoles);
		return roleId === undefined ? undefined : { ...condition, roleId };
	}
	if (library.customFields[condition.definitionId]?.level === 'person') {
		return condition;
	}
	const definitionId = matchedFieldId(library.customFields, condition.definitionId, targetFields);
	return definitionId === undefined ? undefined : { ...condition, definitionId };
}

function copyFilter(
	conditions: readonly FilterCondition[],
	library: Library,
	targetFields: readonly CustomFieldDefinition[],
	targetRoles: readonly Role[]
): CopiedFilter {
	const copied: FilterCondition[] = [];
	const unmatched: UnmatchedPart[] = [];
	for (const condition of conditions) {
		const carried = copiedCondition(condition, library, targetFields, targetRoles);
		if (carried === undefined) {
			unmatched.push({ kind: 'condition', condition });
			continue;
		}
		copied.push(carried);
	}
	return { conditions: copied, unmatched };
}

export function copyExportViewToEvent(
	library: Library,
	view: ExportView,
	targetEventId: string
): ExportViewCopy {
	if (view.level !== 'participant') {
		throw new Error('Only a Participant-level Export View belongs to an Event');
	}
	const targetFields = listParticipantFields(library.customFields, targetEventId);
	const targetRoles = listRoles(library.roles, targetEventId);
	const copiedColumns = copyColumns(view.columns, library.customFields, targetFields);
	const copiedFilter = copyFilter(filterOf(view), library, targetFields, targetRoles);
	const name = normalizeViewName(library.exportViews, 'participant', targetEventId, view.name);
	const copy = buildExportView(
		newRecordId(),
		name,
		'participant',
		targetEventId,
		copiedFilter.conditions,
		copiedColumns.columns
	);
	const unmatched = [...copiedColumns.unmatched, ...copiedFilter.unmatched];
	return { view: copy, unmatched };
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

function selectPersons(library: Library, conditions: readonly FilterCondition[]): Person[] {
	const persons = listPersonsByName(library.persons);
	return persons.filter((person) => {
		const record = { person };
		return matchesFilter(conditions, library.customFields, record);
	});
}

function selectParticipants(
	library: Library,
	eventId: string,
	conditions: readonly FilterCondition[]
): Participant[] {
	const participants = listParticipants(library.participants, eventId);
	return participants.filter((participant) => {
		const record = { person: library.persons[participant.person], participant };
		return matchesFilter(conditions, library.customFields, record);
	});
}

function personRows(library: Library, view: ExportView): string[][] {
	const persons = selectPersons(library, filterOf(view));
	return persons.map((person) => personRow(view.columns, person));
}

function participantRows(library: Library, view: ExportView): string[][] {
	const eventId = view.event ?? '';
	const participants = selectParticipants(library, eventId, filterOf(view));
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

const PREVIEW_SAMPLE_LIMIT = 5;

export interface FilterPreview {
	readonly matching: number;
	readonly total: number;
	readonly sampleNames: readonly string[];
}

function personPreview(library: Library, conditions: readonly FilterCondition[]): FilterPreview {
	const persons = selectPersons(library, conditions);
	const sample = persons.slice(0, PREVIEW_SAMPLE_LIMIT);
	return {
		matching: persons.length,
		total: Object.keys(library.persons).length,
		sampleNames: sample.map((person) => person.name)
	};
}

function participantPreview(
	library: Library,
	eventId: string,
	conditions: readonly FilterCondition[]
): FilterPreview {
	const participants = selectParticipants(library, eventId, conditions);
	const sample = participants.slice(0, PREVIEW_SAMPLE_LIMIT);
	return {
		matching: participants.length,
		total: listParticipants(library.participants, eventId).length,
		sampleNames: sample.map((participant) => library.persons[participant.person].name)
	};
}

export function previewFilter(
	library: Library,
	level: ExportLevel,
	eventId: string | undefined,
	conditions: readonly FilterCondition[]
): FilterPreview {
	if (level === 'person') {
		return personPreview(library, conditions);
	}
	return participantPreview(library, eventId ?? '', conditions);
}

export function exportFileName(view: ExportView): string {
	const slug = view.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
	return `${slug === '' ? 'Export-Ansicht' : slug}.csv`;
}
