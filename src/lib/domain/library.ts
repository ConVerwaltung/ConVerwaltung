import type { CustomFieldDefinition } from './custom-field';
import type { Event } from './event';
import type { ExportView } from './export-view';
import type { ImportMapping } from './import-mapping';
import type { Person } from './person';
import type { Participant } from './participant';
import type { Role } from './role';

export interface LibraryRecord {
	readonly id: string;
}

export interface EventScopedRecord extends LibraryRecord {
	readonly event: string;
}

export interface RecordKey {
	readonly section: LibrarySection;
	readonly id: string;
}

// Sections hold plain objects rather than `Map` so a `$state` proxy can observe them deeply.
export interface Library {
	events: Record<string, Event>;
	persons: Record<string, Person>;
	participants: Record<string, Participant>;
	roles: Record<string, Role>;
	customFields: Record<string, CustomFieldDefinition>;
	importMappings: Record<string, ImportMapping>;
	exportViews: Record<string, ExportView>;
}

export type LibrarySection = keyof Library;

export type SectionRecord<S extends LibrarySection> = Library[S][string];

// Mapped over the sections so a put always pairs a record with the section it belongs to.
export type RecordPut = {
	[S in LibrarySection]: { readonly section: S; readonly record: SectionRecord<S> };
}[LibrarySection];

export interface WriteBatch {
	readonly puts?: readonly RecordPut[];
	readonly deletes?: readonly RecordKey[];
}

export const librarySections: readonly LibrarySection[] = [
	'events',
	'persons',
	'participants',
	'roles',
	'customFields',
	'importMappings',
	'exportViews'
];

export function createEmptyLibrary(): Library {
	return {
		events: {},
		persons: {},
		participants: {},
		roles: {},
		customFields: {},
		importMappings: {},
		exportViews: {}
	};
}

/** UUID v7 ids are timestamp-prefixed, so sorting by id yields creation order. */
export function compareByCreation(a: LibraryRecord, b: LibraryRecord): number {
	return a.id.localeCompare(b.id);
}

export function countRecords(library: Library): number {
	return librarySections.reduce((sum, section) => sum + Object.keys(library[section]).length, 0);
}
