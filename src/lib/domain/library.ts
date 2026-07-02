// The Library (CONTEXT.md): the complete dataset held on one device. Per ADR-0006 it
// lives fully in memory as the single source of truth; IndexedDB is only a persistence
// edge behind it. This module is framework-free — no `svelte` imports.

/** Every record in the Library is keyed by a UUID v7 (ADR-0006). */
export interface LibraryRecord {
	readonly id: string;
}

/**
 * The sections of the Library, mirroring its definition in CONTEXT.md: all Events,
 * the shared Person pool, their Participants, and the organizer's Import Mappings
 * and Export Views. Records are indexed by id; plain objects (not `Map`) so a
 * `$state` proxy can observe them deeply.
 */
export interface Library {
	events: Record<string, LibraryRecord>;
	persons: Record<string, LibraryRecord>;
	participants: Record<string, LibraryRecord>;
	importMappings: Record<string, LibraryRecord>;
	exportViews: Record<string, LibraryRecord>;
}

export type LibrarySection = keyof Library;

export const librarySections: readonly LibrarySection[] = [
	'events',
	'persons',
	'participants',
	'importMappings',
	'exportViews'
];

export function createEmptyLibrary(): Library {
	return {
		events: {},
		persons: {},
		participants: {},
		importMappings: {},
		exportViews: {}
	};
}

export function countRecords(library: Library): number {
	return librarySections.reduce((sum, section) => sum + Object.keys(library[section]).length, 0);
}
