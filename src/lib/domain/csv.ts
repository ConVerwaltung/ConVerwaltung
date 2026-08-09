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

// Comma-delimited with CRLF line endings; cells containing a delimiter, a quote
// or a line break are quoted and their quotes doubled.
export function formatCsv(table: CsvTable): string {
	const fields = [...table.columns];
	const data = table.rows.map((row) => [...row]);
	return Papa.unparse({ fields, data });
}
