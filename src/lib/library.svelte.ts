// The thin reactive holder of the in-memory Library (ADR-0008): the only place where
// runes and the persistence edge meet. Domain logic stays in $lib/domain.
import {
	createEmptyLibrary,
	type LibrarySection,
	type RecordKey,
	type SectionRecord
} from '$lib/domain/library';
import {
	deleteRecords,
	loadLibrary,
	openLibraryDb,
	putRecord,
	type LibraryDb
} from '$lib/store/library-db';

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
export async function upsertRecord<S extends LibrarySection>(
	section: S,
	record: SectionRecord<S>
): Promise<void> {
	if (db === undefined) {
		throw new Error('Library not booted — call bootLibrary() first');
	}
	libraryState.library[section][record.id] = record;
	// Snapshot before persisting: IndexedDB's structured clone rejects $state proxies.
	// The snapshot of a plain record is structurally identical; the cast restores the
	// section type that Snapshot<T> erases.
	await putRecord(db, section, $state.snapshot(record) as SectionRecord<S>);
}

/** Remove records from the in-memory Library and delete them from IndexedDB. */
export async function removeRecords(keys: readonly RecordKey[]): Promise<void> {
	if (db === undefined) {
		throw new Error('Library not booted — call bootLibrary() first');
	}
	for (const { section, id } of keys) {
		delete libraryState.library[section][id];
	}
	await deleteRecords(db, keys);
}
