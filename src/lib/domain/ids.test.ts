import { describe, expect, it } from 'vitest';
import { creationTimeOf, newRecordId } from './ids';

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

describe('creationTimeOf', () => {
	// The UUID v7 of RFC 9562 §5.7: its 48-bit prefix 0x017F22E279D0 is
	// 1645557742032 milliseconds since the epoch.
	const RFC_EXAMPLE_ID = '017f22e2-79d0-7cc3-98c4-dc0c0c07398f';

	it('decodes the timestamp out of a known UUID v7', () => {
		expect(creationTimeOf(RFC_EXAMPLE_ID)?.toISOString()).toBe('2022-02-22T19:22:22.032Z');
	});

	it('reads the id case-insensitively', () => {
		expect(creationTimeOf(RFC_EXAMPLE_ID.toUpperCase())).toEqual(creationTimeOf(RFC_EXAMPLE_ID));
	});

	it('dates a freshly minted record id at now', () => {
		const before = Date.now();
		const id = newRecordId();

		const creationTime = creationTimeOf(id);

		expect(creationTime?.getTime()).toBeGreaterThanOrEqual(before);
		expect(creationTime?.getTime()).toBeLessThanOrEqual(Date.now());
	});

	it('rejects a UUID that is not v7 rather than returning a nonsense date', () => {
		expect(creationTimeOf('9d1b9d5c-3f2a-4b8e-9c1d-2f3a4b5c6d7e')).toBeUndefined();
		expect(creationTimeOf('00000000-0000-0000-0000-000000000000')).toBeUndefined();
	});

	it('rejects anything that is not a UUID', () => {
		expect(creationTimeOf('')).toBeUndefined();
		expect(creationTimeOf('ada')).toBeUndefined();
		expect(creationTimeOf('017f22e2-79d0-7cc3-98c4-dc0c0c07398')).toBeUndefined();
	});
});
