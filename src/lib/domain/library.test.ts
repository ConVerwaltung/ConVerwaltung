import { describe, expect, it } from 'vitest';
import { countRecords, createEmptyLibrary, librarySections } from './library';

describe('createEmptyLibrary', () => {
	it('yields every section empty', () => {
		const library = createEmptyLibrary();

		for (const section of librarySections) {
			expect(library[section]).toEqual({});
		}
	});
});

describe('countRecords', () => {
	it('is 0 for an empty Library', () => {
		expect(countRecords(createEmptyLibrary())).toBe(0);
	});

	it('sums records across all sections', () => {
		const library = createEmptyLibrary();
		library.events['e1'] = { id: 'e1', name: 'Sommerfest' };
		library.persons['p1'] = { id: 'p1' };
		library.persons['p2'] = { id: 'p2' };

		expect(countRecords(library)).toBe(3);
	});
});
