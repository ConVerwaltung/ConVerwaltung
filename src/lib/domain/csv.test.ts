import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
	it('reads the first row as columns and the rest as rows', () => {
		const table = parseCsv('Name,Rolle\nAda,Gast\nGrace,Helferin\n');

		expect(table.columns).toEqual(['Name', 'Rolle']);
		expect(table.rows).toEqual([
			['Ada', 'Gast'],
			['Grace', 'Helferin']
		]);
	});

	it('auto-detects semicolon and tab delimiters', () => {
		expect(parseCsv('Name;Rolle\nAda;Gast\n').rows).toEqual([['Ada', 'Gast']]);
		expect(parseCsv('Name\tRolle\nAda\tGast\n').rows).toEqual([['Ada', 'Gast']]);
	});

	it('reads quoted cells containing delimiters, quotes, and line breaks', () => {
		const table = parseCsv('Name,Notiz\n"Müller, Ada","sagt ""hallo""\nzweite Zeile"\n');

		expect(table.rows).toEqual([['Müller, Ada', 'sagt "hallo"\nzweite Zeile']]);
	});

	it('strips a UTF-8 BOM before the first column name', () => {
		const table = parseCsv('\uFEFFName,Rolle\nAda,Gast\n');

		expect(table.columns).toEqual(['Name', 'Rolle']);
	});

	it('trims column names and skips blank lines', () => {
		const table = parseCsv(' Name ; Rolle \nAda;Gast\n\n   \n');

		expect(table.columns).toEqual(['Name', 'Rolle']);
		expect(table.rows).toEqual([['Ada', 'Gast']]);
	});

	it('keeps a row shorter than the columns as-is', () => {
		const table = parseCsv('Name,Rolle\nAda\n');

		expect(table.rows).toEqual([['Ada']]);
	});

	it('allows blank column names but rejects duplicates', () => {
		expect(parseCsv('Name,,Rolle,\nAda,x,Gast,y\n').columns).toEqual(['Name', '', 'Rolle', '']);
		expect(() => parseCsv('Name,Rolle,Name\nAda,Gast,Zusatz\n')).toThrow(/Name/);
	});

	it('rejects empty input', () => {
		expect(() => parseCsv('')).toThrow();
	});

	it('rejects malformed quoting', () => {
		expect(() => parseCsv('Name,Notiz\nAda,"offen\n')).toThrow();
	});
});
