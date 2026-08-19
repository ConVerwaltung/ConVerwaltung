import Papa from 'papaparse';

export interface CsvTable {
	readonly columns: readonly string[];
	/** Data rows in file order; a row may be shorter than `columns`. */
	readonly rows: readonly (readonly string[])[];
}

export type CsvParseReason = 'quotes' | 'empty' | 'duplicateColumn';

/*
	An unreadable file is the one Import error the organizer has to fix in the file itself,
	so the failure carries what the remedy needs — which line, and which column name — rather
	than a sentence the screen would have to take apart again.
*/
export class CsvParseError extends Error {
	readonly reason: CsvParseReason;
	/** The file line objected to, the header row counted as 1; absent for an empty file. */
	readonly line?: number;
	readonly column?: string;

	constructor(reason: CsvParseReason, message: string, line?: number, column?: string) {
		super(message);
		this.name = 'CsvParseError';
		this.reason = reason;
		this.line = line;
		this.column = column;
	}
}

function assertUniqueColumns(columns: readonly string[]): void {
	const seen = new Set<string>();
	for (const column of columns) {
		if (column === '') {
			continue;
		}
		if (seen.has(column)) {
			throw new CsvParseError('duplicateColumn', `Duplicate column name “${column}”`, 1, column);
		}
		seen.add(column);
	}
}

// Papa counts its rows from the header, so the file line is one more than the index.
function lineOf(row: number | undefined): number | undefined {
	return row === undefined ? undefined : row + 1;
}

// Delimiter is auto-detected (comma, semicolon, tab, …); a leading UTF-8 BOM
// is stripped so it cannot end up in the first column name.
export function parseCsv(text: string): CsvTable {
	const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
	const quoting = result.errors.find((error) => error.type === 'Quotes');
	if (quoting !== undefined) {
		throw new CsvParseError('quotes', 'CSV quoting is malformed', lineOf(quoting.row));
	}
	const [headerRow, ...rows] = result.data;
	if (headerRow === undefined) {
		throw new CsvParseError('empty', 'CSV file is empty');
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
