import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import type { CsvTable } from './csv';
import {
	defineImportMapping,
	duplicateImportMapping,
	identityChainOf,
	identityColumnsOf,
	isImportMappingNameDefined,
	listImportMappingsByName,
	missingMappedColumns,
	remapImportMapping,
	renameImportMapping,
	shapeRows,
	type ColumnTarget,
	type ImportMapping
} from './import-mapping';

const identityOnly: Readonly<Record<string, ColumnTarget>> = { Name: { kind: 'identity' } };

function mapping(
	id: string,
	name: string,
	columns: Readonly<Record<string, ColumnTarget>> = identityOnly
): ImportMapping {
	return { id, name, columns };
}

describe('defineImportMapping', () => {
	it('creates a named Import Mapping with a UUID v7 id', () => {
		const created = defineImportMapping({}, '  Anmeldeliste ', identityOnly);

		expect(created.name).toBe('Anmeldeliste');
		expect(created.columns).toEqual(identityOnly);
		expect(uuidValidate(created.id)).toBe(true);
		expect(uuidVersion(created.id)).toBe(7);
	});

	it('rejects a blank name', () => {
		expect(() => defineImportMapping({}, '   ', identityOnly)).toThrow();
	});

	it('rejects a name that is already defined', () => {
		const mappings = { a: mapping('a', 'Anmeldeliste') };

		expect(() => defineImportMapping(mappings, 'Anmeldeliste', identityOnly)).toThrow();
	});

	it('rejects columns without a Person-identity column', () => {
		expect(() => defineImportMapping({}, 'Anmeldeliste', {})).toThrow();
		expect(() =>
			defineImportMapping({}, 'Anmeldeliste', { Rolle: { kind: 'role' } })
		).toThrow();
	});

	it('accepts several Person-identity columns', () => {
		const columns: Readonly<Record<string, ColumnTarget>> = {
			Vorname: { kind: 'identity' },
			Nachname: { kind: 'identity' }
		};

		expect(defineImportMapping({}, 'Ticketliste', columns).columns).toEqual(columns);
	});
});

describe('remapImportMapping', () => {
	it('replaces the columns and keeps id and name', () => {
		const columns: Readonly<Record<string, ColumnTarget>> = {
			Vorname: { kind: 'identity' },
			Nachname: { kind: 'identity' },
			Gruppe: { kind: 'role' }
		};

		const remapped = remapImportMapping(mapping('m-1', 'Ticketliste'), columns);

		expect(remapped).toEqual({ id: 'm-1', name: 'Ticketliste', columns });
	});

	it('refuses a remap that names no Person', () => {
		expect(() => remapImportMapping(mapping('m-1', 'Ticketliste'), { Gruppe: { kind: 'role' } })).toThrow();
	});
});

describe('renameImportMapping', () => {
	it('trims the new name and keeps id and columns', () => {
		const mappings = { 'm-1': mapping('m-1', 'Ticketliste') };

		const renamed = renameImportMapping(mappings, mappings['m-1'], '  Anmeldeliste ');

		expect(renamed).toEqual({ id: 'm-1', name: 'Anmeldeliste', columns: identityOnly });
	});

	it('refuses a blank name', () => {
		const mappings = { 'm-1': mapping('m-1', 'Ticketliste') };

		expect(() => renameImportMapping(mappings, mappings['m-1'], '  ')).toThrow();
	});

	it('refuses a name another Import Mapping already holds', () => {
		const mappings = { 'm-1': mapping('m-1', 'Ticketliste'), 'm-2': mapping('m-2', 'Zusagen') };

		expect(() => renameImportMapping(mappings, mappings['m-1'], 'Zusagen')).toThrow();
	});

	it('accepts the name the Import Mapping already holds', () => {
		const mappings = { 'm-1': mapping('m-1', 'Ticketliste') };

		expect(renameImportMapping(mappings, mappings['m-1'], 'Ticketliste').name).toBe('Ticketliste');
	});
});

describe('duplicateImportMapping', () => {
	it('copies the columns under a free copy name and a new UUID v7 id', () => {
		const columns: Readonly<Record<string, ColumnTarget>> = {
			Vorname: { kind: 'identity' },
			Gruppe: { kind: 'role' }
		};
		const mappings = { 'm-1': mapping('m-1', 'Ticketliste', columns) };

		const copy = duplicateImportMapping(mappings, mappings['m-1']);

		expect(copy.name).toBe('Ticketliste (Kopie)');
		expect(copy.columns).toEqual(columns);
		expect(copy.id).not.toBe('m-1');
		expect(uuidValidate(copy.id)).toBe(true);
		expect(uuidVersion(copy.id)).toBe(7);
	});

	it('counts up while the copy name is taken', () => {
		const mappings = {
			'm-1': mapping('m-1', 'Ticketliste'),
			'm-2': mapping('m-2', 'Ticketliste (Kopie)'),
			'm-3': mapping('m-3', 'Ticketliste (Kopie) 2')
		};

		expect(duplicateImportMapping(mappings, mappings['m-1']).name).toBe('Ticketliste (Kopie) 3');
	});
});

describe('isImportMappingNameDefined', () => {
	it('matches the trimmed name across all Import Mappings', () => {
		const mappings = { a: mapping('a', 'Anmeldeliste') };

		expect(isImportMappingNameDefined(mappings, ' Anmeldeliste ')).toBe(true);
		expect(isImportMappingNameDefined(mappings, 'Helferliste')).toBe(false);
	});
});

describe('listImportMappingsByName', () => {
	it('sorts by name', () => {
		const mappings = { b: mapping('b', 'Zusagen'), a: mapping('a', 'Anmeldeliste') };

		expect(listImportMappingsByName(mappings).map((entry) => entry.name)).toEqual([
			'Anmeldeliste',
			'Zusagen'
		]);
	});
});

describe('identityColumnsOf', () => {
	it('lists the columns targeting the Person identity', () => {
		expect(identityColumnsOf(identityOnly)).toEqual(['Name']);
		expect(identityColumnsOf({ Rolle: { kind: 'role' } })).toEqual([]);
	});
});

describe('identityChainOf', () => {
	const splitName: Readonly<Record<string, ColumnTarget>> = {
		Nachname: { kind: 'identity' },
		Vorname: { kind: 'identity' },
		Rolle: { kind: 'role' }
	};

	it('lists the identity columns in file order, not in mapping order', () => {
		expect(identityChainOf(splitName, ['Rolle', 'Vorname', 'Nachname'])).toEqual([
			'Vorname',
			'Nachname'
		]);
	});

	it('leaves out identity columns the file does not have', () => {
		expect(identityChainOf(splitName, ['Vorname', 'Rolle'])).toEqual(['Vorname']);
	});
});

describe('missingMappedColumns', () => {
	it('lists mapped columns the file does not have', () => {
		const reused = mapping('a', 'Anmeldeliste', {
			Name: { kind: 'identity' },
			Verein: { kind: 'personField', definitionId: 'field-1' }
		});

		expect(missingMappedColumns(reused, ['Name', 'Rolle'])).toEqual(['Verein']);
		expect(missingMappedColumns(reused, ['Name', 'Verein'])).toEqual([]);
	});
});

describe('shapeRows', () => {
	const table: CsvTable = {
		columns: ['Name', 'Verein', 'Zimmer', 'Rolle', 'Intern'],
		rows: [
			['Ada Lovelace', 'SV Nord', '12', 'Gast', 'x'],
			[' Grace Hopper ', '', '', '', 'y']
		]
	};
	const fullMapping = mapping('a', 'Anmeldeliste', {
		Name: { kind: 'identity' },
		Verein: { kind: 'personField', definitionId: 'field-1' },
		Zimmer: { kind: 'participantField', fieldName: 'Zimmer' },
		Rolle: { kind: 'role' }
	});

	it('restates each row under its mapped targets and drops unmapped columns', () => {
		expect(shapeRows(table, fullMapping.columns)).toEqual([
			{
				personName: 'Ada Lovelace',
				personValues: { 'field-1': 'SV Nord' },
				participantValues: { Zimmer: '12' },
				roleNames: ['Gast']
			},
			{
				personName: 'Grace Hopper',
				personValues: {},
				participantValues: {},
				roleNames: []
			}
		]);
	});

	it('collects distinct role names from several role columns', () => {
		const twoRoleColumns = mapping('a', 'Anmeldeliste', {
			Name: { kind: 'identity' },
			Rolle: { kind: 'role' },
			Zusatzrolle: { kind: 'role' }
		});
		const shaped = shapeRows(
			{
				columns: ['Name', 'Rolle', 'Zusatzrolle'],
				rows: [['Ada', 'Gast', 'Helferin'], ['Grace', 'Gast', 'Gast']]
			},
			twoRoleColumns.columns
		);

		expect(shaped.map((row) => row.roleNames)).toEqual([['Gast', 'Helferin'], ['Gast']]);
	});

	it('treats missing cells of a short row as empty', () => {
		const shaped = shapeRows({ columns: table.columns, rows: [['Ada']] }, fullMapping.columns);

		expect(shaped).toEqual([
			{ personName: 'Ada', personValues: {}, participantValues: {}, roleNames: [] }
		]);
	});

	it('skips mapped columns the file does not have', () => {
		const shaped = shapeRows(
			{ columns: ['Name'], rows: [['Ada']] },
			fullMapping.columns
		);

		expect(shaped).toEqual([
			{ personName: 'Ada', personValues: {}, participantValues: {}, roleNames: [] }
		]);
	});

	it('joins several identity columns into one name, in file order', () => {
		const splitName = mapping('a', 'Ticketliste', {
			Nachname: { kind: 'identity' },
			Vorname: { kind: 'identity' },
			Rolle: { kind: 'role' }
		});
		const shaped = shapeRows(
			{
				columns: ['Vorname', 'Nachname', 'Rolle'],
				rows: [
					[' Ada ', 'Lovelace', 'Gast'],
					['', 'Hopper', ''],
					['Grace', '', '']
				]
			},
			splitName.columns
		);

		expect(shaped.map((row) => row.personName)).toEqual(['Ada Lovelace', 'Hopper', 'Grace']);
	});

	it('names no Person when every identity column of the row is empty', () => {
		const shaped = shapeRows(
			{ columns: ['Vorname', 'Nachname'], rows: [['  ', '']] },
			{ Vorname: { kind: 'identity' }, Nachname: { kind: 'identity' } }
		);

		expect(shaped[0].personName).toBe('');
	});

	it('reads the identity columns the file has when one is missing', () => {
		const shaped = shapeRows(
			{ columns: ['Vorname'], rows: [['Ada']] },
			{ Vorname: { kind: 'identity' }, Nachname: { kind: 'identity' } }
		);

		expect(shaped[0].personName).toBe('Ada');
	});

	it('rejects a file without the Person-identity column', () => {
		expect(() =>
			shapeRows(
				{ columns: ['Verein', 'Rolle'], rows: [['SV Nord', 'Gast']] },
				fullMapping.columns
			)
		).toThrow();
	});
});
