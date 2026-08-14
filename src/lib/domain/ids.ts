// Native crypto.randomUUID() emits only v4; Library keys are UUID v7.
import { v7 as uuidv7, validate as isUuid, version as uuidVersion } from 'uuid';

export function newRecordId(): string {
	return uuidv7();
}

/**
 * The creation time a UUID v7 record id carries in its leading 48 bits. No record
 * stores a date of its own, so this is the only creation time there is; anything
 * that is not a UUID v7 yields `undefined` rather than a nonsense date.
 */
export function creationTimeOf(id: string): Date | undefined {
	if (!isUuid(id) || uuidVersion(id) !== 7) {
		return undefined;
	}
	const millisecondsSinceEpoch = Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
	return new Date(millisecondsSinceEpoch);
}
