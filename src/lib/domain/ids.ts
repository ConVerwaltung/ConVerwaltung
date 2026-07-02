// UUID v7 via the `uuid` package — native crypto.randomUUID() emits only v4 (ADR-0006).
import { v7 as uuidv7 } from 'uuid';

export function newRecordId(): string {
	return uuidv7();
}
