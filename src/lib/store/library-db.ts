// Thin persistence edge per ADR-0006: one IndexedDB object store per Library section,
// touched only by the load/persist functions below. Framework-free — no `svelte` imports.
import { openDB, type IDBPDatabase } from 'idb';
import {
	createEmptyLibrary,
	librarySections,
	type Library,
	type LibraryRecord,
	type LibrarySection
} from '$lib/domain/library';

type LibraryDbSchema = {
	[S in LibrarySection]: { key: string; value: LibraryRecord };
};

export type LibraryDb = IDBPDatabase<LibraryDbSchema>;

const DB_NAME = 'amts-library';
const DB_VERSION = 1;

export async function openLibraryDb(name: string = DB_NAME): Promise<LibraryDb> {
	return openDB<LibraryDbSchema>(name, DB_VERSION, {
		upgrade(db) {
			for (const section of librarySections) {
				if (!db.objectStoreNames.contains(section)) {
					db.createObjectStore(section, { keyPath: 'id' });
				}
			}
		}
	});
}

/** One full read of the store into memory — the boot cost accepted in ADR-0006. */
export async function loadLibrary(db: LibraryDb): Promise<Library> {
	const library = createEmptyLibrary();
	for (const section of librarySections) {
		for (const record of await db.getAll(section)) {
			library[section][record.id] = record;
		}
	}
	return library;
}

/** Write-through of one changed record. `record` must be a plain object, not a `$state` proxy. */
export async function putRecord(
	db: LibraryDb,
	section: LibrarySection,
	record: LibraryRecord
): Promise<void> {
	await db.put(section, record);
}
