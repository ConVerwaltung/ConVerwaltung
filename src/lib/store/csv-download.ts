// The byte-order mark keeps spreadsheet applications from reading the UTF-8
// bytes as the local codepage; parsing strips it again.
const UTF8_BOM = '\uFEFF';

export function downloadCsv(fileName: string, text: string): void {
	const blob = new Blob([UTF8_BOM, text], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}
