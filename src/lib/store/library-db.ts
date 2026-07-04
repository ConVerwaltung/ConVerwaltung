import { openDB, type IDBPDatabase } from 'idb';
import {
	createEmptyLibrary,
	librarySections,
	type Library,
	type LibrarySection,
	type RecordKey,
	type SectionRecord
} from '$lib/domain/library';

type LibraryDbSchema = {
	[S in LibrarySection]: { key: string; value: SectionRecord<S> };
};

export type LibraryDb = IDBPDatabase<LibraryDbSchema>;

const DB_NAME = 'amts-library';
// The upgrade callback creates whichever section stores are missing; a new
// section only needs this version raised.
const DB_VERSION = 3;

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

export async function loadLibrary(db: LibraryDb): Promise<Library> {
	const library = createEmptyLibrary();
	for (const section of librarySections) {
		for (const record of await db.getAll(section)) {
			library[section][record.id] = record;
		}
	}
	return library;
}

/** `record` must be a plain object, not a `$state` proxy. */
export async function putRecord<S extends LibrarySection>(
	db: LibraryDb,
	section: S,
	record: SectionRecord<S>
): Promise<void> {
	await db.put(section, record);
}

export async function deleteRecords(db: LibraryDb, keys: readonly RecordKey[]): Promise<void> {
	if (keys.length === 0) {
		return;
	}
	const sections = [...new Set(keys.map((key) => key.section))];
	const tx = db.transaction(sections, 'readwrite');
	for (const { section, id } of keys) {
		void tx.objectStore(section).delete(id);
	}
	await tx.done;
}
