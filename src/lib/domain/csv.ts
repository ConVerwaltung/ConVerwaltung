import Papa from 'papaparse';

export interface CsvTable {
	readonly columns: readonly string[];
	/** Data rows in file order; a row may be shorter than `columns`. */
	readonly rows: readonly (readonly string[])[];
}

function assertUniqueColumns(columns: readonly string[]): void {
	const seen = new Set<string>();
	for (const column of columns) {
		if (column === '') {
			continue;
		}
		if (seen.has(column)) {
			throw new Error(`Duplicate column name “${column}”`);
		}
		seen.add(column);
	}
}

// Delimiter is auto-detected (comma, semicolon, tab, …); a leading UTF-8 BOM
// is stripped so it cannot end up in the first column name.
export function parseCsv(text: string): CsvTable {
	const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
	if (result.errors.some((error) => error.type === 'Quotes')) {
		throw new Error('CSV quoting is malformed');
	}
	const [headerRow, ...rows] = result.data;
	if (headerRow === undefined) {
		throw new Error('CSV file is empty');
	}
	const columns = headerRow.map((column) => column.trim());
	assertUniqueColumns(columns);
	return { columns, rows };
}
