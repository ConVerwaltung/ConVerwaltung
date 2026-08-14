import { openDB, type IDBPDatabase } from 'idb';
import {
	createEmptyLibrary,
	librarySections,
	type Library,
	type LibrarySection,
	type SectionRecord,
	type WriteBatch
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

/** Records must be plain objects, not `$state` proxies. */
export async function writeBatch(
	db: LibraryDb,
	{ puts = [], deletes = [] }: WriteBatch
): Promise<void> {
	if (puts.length === 0 && deletes.length === 0) {
		return;
	}
	const putSections = puts.map((put) => put.section);
	const deleteSections = deletes.map((key) => key.section);
	const sections = [...new Set([...putSections, ...deleteSections])];
	const tx = db.transaction(sections, 'readwrite');
	const requests: Promise<unknown>[] = [];
	try {
		for (const { section, record } of puts) {
			requests.push(tx.objectStore(section).put(record));
		}
		for (const { section, id } of deletes) {
			requests.push(tx.objectStore(section).delete(id));
		}
	} catch (error) {
		// A request that throws synchronously — an invalid key, an uncloneable value —
		// would otherwise leave the preceding ones to commit on their own. Aborting
		// rejects them all, which is what the settle below collects.
		tx.abort();
		await Promise.allSettled([...requests, tx.done]);
		throw error;
	}
	await Promise.all([...requests, tx.done]);
}
