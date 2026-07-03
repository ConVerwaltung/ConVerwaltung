// Note (CONTEXT.md): a single multiline free-text field on a Person or a Participant
// for unstructured commentary. Not a list of discrete entries — remarks are separated
// by line breaks within the one field. Framework-free — no `svelte` imports.
import type { LibraryRecord } from './library';

/** A record carrying a Note. An absent Note reads as empty. */
export interface NotedRecord extends LibraryRecord {
	readonly note?: string;
}

/** The Note text of a record; absent means empty. */
export function noteOf(record: NotedRecord): string {
	return record.note ?? '';
}

/** Replace the record's Note verbatim — line breaks are kept; empty text clears it. */
export function editNote<T extends NotedRecord>(record: T, note: string): T {
	return { ...record, note };
}
