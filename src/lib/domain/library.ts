// The Library (CONTEXT.md): the complete dataset held on one device. Per ADR-0006 it
// lives fully in memory as the single source of truth; IndexedDB is only a persistence
// edge behind it. This module is framework-free — no `svelte` imports.

import type { CustomFieldDefinition } from './custom-field';
import type { Event } from './event';
import type { Person } from './person';
import type { Participant } from './participant';
import type { Role } from './role';

/** Every record in the Library is keyed by a UUID v7 (ADR-0006). */
export interface LibraryRecord {
	readonly id: string;
}

/**
 * A record living in one Event's scope: a scoped delete of that Event removes it.
 * Participants and Roles; Participant-level Custom Field definitions carry the same
 * `event` reference as an optional field. Persons are never event-scoped (ADR-0005).
 */
export interface EventScopedRecord extends LibraryRecord {
	readonly event: string;
}

/** Address of one record in the Library: its section and id. */
export interface RecordKey {
	readonly section: LibrarySection;
	readonly id: string;
}

/**
 * The sections of the Library, mirroring its definition in CONTEXT.md: all Events,
 * the shared Person pool, their Participants and Roles, the Custom Field definitions
 * (values live on the records they describe), and the organizer's Import Mappings and
 * Export Views. Records are indexed by id; plain objects (not `Map`) so a `$state`
 * proxy can observe them deeply.
 */
export interface Library {
	events: Record<string, Event>;
	persons: Record<string, Person>;
	participants: Record<string, Participant>;
	roles: Record<string, Role>;
	customFields: Record<string, CustomFieldDefinition>;
	importMappings: Record<string, LibraryRecord>;
	exportViews: Record<string, LibraryRecord>;
}

export type LibrarySection = keyof Library;

/** The record type stored in a given Library section. */
export type SectionRecord<S extends LibrarySection> = Library[S][string];

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

export function countRecords(library: Library): number {
	return librarySections.reduce((sum, section) => sum + Object.keys(library[section]).length, 0);
}
