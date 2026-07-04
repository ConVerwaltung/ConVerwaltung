import type { LibraryRecord } from './library';

export interface NotedRecord extends LibraryRecord {
	readonly note?: string;
}

export function noteOf(record: NotedRecord): string {
	return record.note ?? '';
}

export function editNote<T extends NotedRecord>(record: T, note: string): T {
	return { ...record, note };
}
