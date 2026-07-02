// The thin reactive holder of the in-memory Library (ADR-0008): the only place where
// runes and the persistence edge meet. Domain logic stays in $lib/domain.
import { createEmptyLibrary, type LibraryRecord, type LibrarySection } from '$lib/domain/library';
import { loadLibrary, openLibraryDb, putRecord, type LibraryDb } from '$lib/store/library-db';

export type LibraryStatus = 'loading' | 'ready' | 'error';

export const libraryState = $state({
	status: 'loading' as LibraryStatus,
	library: createEmptyLibrary()
});

let db: LibraryDb | undefined;

/** Boot: load the full store into the in-memory Library. Call once, in the browser. */
export async function bootLibrary(): Promise<void> {
	try {
		db = await openLibraryDb();
		libraryState.library = await loadLibrary(db);
		libraryState.status = 'ready';
	} catch (error) {
		libraryState.status = 'error';
		throw error;
	}
}

/** Mutate the in-memory Library and write the changed record through to IndexedDB. */
export async function upsertRecord(section: LibrarySection, record: LibraryRecord): Promise<void> {
	if (db === undefined) {
		throw new Error('Library not booted — call bootLibrary() first');
	}
	libraryState.library[section][record.id] = record;
	// Snapshot before persisting: IndexedDB's structured clone rejects $state proxies.
	await putRecord(db, section, $state.snapshot(record));
}
