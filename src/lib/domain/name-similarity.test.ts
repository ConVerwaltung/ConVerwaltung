import { describe, expect, it } from 'vitest';
import { nameSimilarity, nameTokens } from './name-similarity';

describe('nameTokens', () => {
	it('lowercases and splits on whitespace, commas, dots and hyphens', () => {
		expect(nameTokens('  Schmidt,  Anna-Maria  ')).toEqual(['schmidt', 'anna', 'maria']);
		expect(nameTokens('Dr. Ada Lovelace')).toEqual(['dr', 'ada', 'lovelace']);
	});

	it('expands German ligatures instead of dropping them', () => {
		expect(nameTokens('Müller')).toEqual(['mueller']);
		expect(nameTokens('Mueller')).toEqual(['mueller']);
		expect(nameTokens('Weiß')).toEqual(['weiss']);
	});

	it('strips the remaining diacritics', () => {
		expect(nameTokens('Renée Curie')).toEqual(['renee', 'curie']);
	});

	it('normalizes a decomposed umlaut like its composed form', () => {
		expect(nameTokens('Müller')).toEqual(['mueller']);
	});

	it('keeps letters of other scripts', () => {
		expect(nameTokens('Анна Иванова')).toEqual(['анна', 'иванова']);
	});

	it('yields nothing for a name without letters or digits', () => {
		expect(nameTokens('  ,. ')).toEqual([]);
	});
});

describe('nameSimilarity', () => {
	it('scores transliterated umlauts as identical', () => {
		expect(nameSimilarity('Thomas Mueller', 'Thomas Müller')).toBe(1);
	});

	it('ignores token order, case and whitespace', () => {
		expect(nameSimilarity('Anna Maria Schmidt', 'Schmidt,  anna   maria')).toBe(1);
	});

	it('scores a missing middle name high but below identical', () => {
		const similarity = nameSimilarity('Anna Schmidt', 'Anna Maria Schmidt');
		expect(similarity).toBeGreaterThan(0.7);
		expect(similarity).toBeLessThan(1);
	});

	it('tolerates a typo within a token', () => {
		expect(nameSimilarity('Anna Schmidt', 'Anna Schmitd')).toBeGreaterThan(0.8);
	});

	it('scores unrelated names low', () => {
		expect(nameSimilarity('Ada Lovelace', 'Grace Hopper')).toBeLessThan(0.4);
	});

	it('scores a name without letters against anything as zero', () => {
		expect(nameSimilarity('...', 'Ada Lovelace')).toBe(0);
	});

	it('is symmetric', () => {
		const forward = nameSimilarity('Anna Schmidt', 'Anna Maria Schmidt');
		const backward = nameSimilarity('Anna Maria Schmidt', 'Anna Schmidt');
		expect(forward).toBe(backward);
	});
});
