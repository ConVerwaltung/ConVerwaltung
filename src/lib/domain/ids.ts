// Native crypto.randomUUID() emits only v4; Library keys are UUID v7.
import { v7 as uuidv7 } from 'uuid';

export function newRecordId(): string {
	return uuidv7();
}
