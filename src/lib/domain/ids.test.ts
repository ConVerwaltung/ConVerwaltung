import { describe, expect, it } from 'vitest';
import { newRecordId } from './ids';

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newRecordId', () => {
	it('produces a UUID v7', () => {
		expect(newRecordId()).toMatch(UUID_V7_PATTERN);
	});

	it('produces time-ordered ids (creation-order sort per ADR-0006)', () => {
		const first = newRecordId();
		const second = newRecordId();

		expect(first < second).toBe(true);
	});
});
