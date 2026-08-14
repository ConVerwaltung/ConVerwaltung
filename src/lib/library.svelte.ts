import {
	createEmptyLibrary,
	type LibrarySection,
	type RecordKey,
	type RecordPut,
	type SectionRecord,
	type WriteBatch
} from '$lib/domain/library';
import { loadLibrary, openLibraryDb, writeBatch, type LibraryDb } from '$lib/store/library-db';

export type LibraryStatus = 'loading' | 'ready' | 'error';

export const libraryState = $state({
	status: 'loading' as LibraryStatus,
	library: createEmptyLibrary(),
	writeFailure: null as string | null
});

let db: LibraryDb | undefined;

/** Call once, in the browser. */
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

/** Persists first, so a failed write leaves the in-memory Library untouched. */
export async function commitBatch(batch: WriteBatch): Promise<void> {
	const persisted = await persistBatch(batch);
	if (!persisted) {
		return;
	}
	applyToLibrary(batch);
}

export async function upsertRecord<S extends LibrarySection>(
	section: S,
	record: SectionRecord<S>
): Promise<void> {
	const put = { section, record } as RecordPut;
	await commitBatch({ puts: [put] });
}

export async function removeRecords(keys: readonly RecordKey[]): Promise<void> {
	await commitBatch({ deletes: keys });
}

async function persistBatch(batch: WriteBatch): Promise<boolean> {
	if (db === undefined) {
		throw new Error('Library not booted — call bootLibrary() first');
	}
	const storable = detachProxies(batch);
	try {
		await writeBatch(db, storable);
		libraryState.writeFailure = null;
		return true;
	} catch (error) {
		libraryState.writeFailure = describeFailure(error);
		return false;
	}
}

function detachProxies({ puts = [], deletes }: WriteBatch): WriteBatch {
	// IndexedDB's structured clone rejects $state proxies. The snapshot of a plain record is
	// structurally identical; the cast restores the section pairing that Snapshot<T> erases.
	const detached = puts.map(({ section, record }) => {
		const stored = $state.snapshot(record) as SectionRecord<LibrarySection>;
		return { section, record: stored } as RecordPut;
	});
	return { puts: detached, deletes };
}

function describeFailure(error: unknown): string {
	return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function applyToLibrary({ puts = [], deletes = [] }: WriteBatch): void {
	for (const { section, record } of puts) {
		putIntoSection(section, record);
	}
	for (const { section, id } of deletes) {
		delete libraryState.library[section][id];
	}
}

function putIntoSection<S extends LibrarySection>(section: S, record: SectionRecord<S>): void {
	libraryState.library[section][record.id] = record;
}
