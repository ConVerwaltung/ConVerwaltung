import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import type { CustomFieldDefinition } from './custom-field';
import type { FilterCondition } from './export-filter';
import {
	defineExportView,
	exportFileName,
	filterOf,
	isExportViewNameDefined,
	listExportViews,
	previewFilter,
	projectExportView,
	unresolvedColumnNames,
	type ExportColumn,
	type ExportView
} from './export-view';
import { createEmptyLibrary, type Library } from './library';

const nameColumn: ExportColumn = { source: { kind: 'personName' }, name: 'Name' };

function view(
	id: string,
	name: string,
	level: 'person' | 'participant' = 'person',
	eventId?: string
): ExportView {
	return {
		id,
		name,
		level,
		...(eventId === undefined ? {} : { event: eventId }),
		columns: [nameColumn]
	};
}

describe('defineExportView', () => {
	it('creates a named Person-level Export View with a UUID v7 id', () => {
		const created = defineExportView({}, 'person', undefined, '  Adressliste ', [], [nameColumn]);

		expect(created.name).toBe('Adressliste');
		expect(created.level).toBe('person');
		expect(created.event).toBeUndefined();
		expect(created.filter).toBeUndefined();
		expect(created.columns).toEqual([nameColumn]);
		expect(uuidValidate(created.id)).toBe(true);
		expect(uuidVersion(created.id)).toBe(7);
	});

	it('scopes a Participant-level Export View to its Event', () => {
		const created = defineExportView({}, 'participant', 'ev1', 'Teilnehmerliste', [], [nameColumn]);

		expect(created.level).toBe('participant');
		expect(created.event).toBe('ev1');
	});

	it('trims output column names', () => {
		const created = defineExportView({}, 'person', undefined, 'Adressliste', [], [
			{ source: { kind: 'personName' }, name: '  Voller Name  ' }
		]);

		expect(created.columns[0].name).toBe('Voller Name');
	});

	it('keeps the filter conditions, normalized', () => {
		const filter: FilterCondition[] = [
			{ kind: 'role', roleId: 'ro1', holds: true },
			{ kind: 'field', definitionId: 'cf1', test: { kind: 'equals', value: ' SV Nord ' } }
		];

		const created = defineExportView({}, 'person', undefined, 'Adressliste', filter, [nameColumn]);

		expect(created.filter).toEqual([
			{ kind: 'role', roleId: 'ro1', holds: true },
			{ kind: 'field', definitionId: 'cf1', test: { kind: 'equals', value: 'SV Nord' } }
		]);
	});

	it('rejects a filter condition comparing against a blank value', () => {
		const filter: FilterCondition[] = [
			{ kind: 'field', definitionId: 'cf1', test: { kind: 'equals', value: '  ' } }
		];

		expect(() =>
			defineExportView({}, 'person', undefined, 'Adressliste', filter, [nameColumn])
		).toThrow();
	});

	it('rejects a blank name', () => {
		expect(() => defineExportView({}, 'person', undefined, '   ', [], [nameColumn])).toThrow();
	});

	it('rejects a name already defined at the same level and Event', () => {
		const views = { a: view('a', 'Adressliste') };

		expect(() =>
			defineExportView(views, 'person', undefined, 'Adressliste', [], [nameColumn])
		).toThrow();
	});

	it('allows the same name at another level or in another Event', () => {
		const views = {
			a: view('a', 'Liste'),
			b: view('b', 'Liste', 'participant', 'ev1')
		};

		expect(defineExportView(views, 'participant', 'ev2', 'Liste', [], [nameColumn]).name).toBe(
			'Liste'
		);
	});

	it('rejects an Export View without columns', () => {
		expect(() => defineExportView({}, 'person', undefined, 'Adressliste', [], [])).toThrow();
	});

	it('rejects a blank output column name', () => {
		expect(() =>
			defineExportView({}, 'person', undefined, 'Adressliste', [], [
				{ source: { kind: 'personName' }, name: '  ' }
			])
		).toThrow();
	});

	it('rejects repeated output column names', () => {
		expect(() =>
			defineExportView({}, 'person', undefined, 'Adressliste', [], [
				nameColumn,
				{ source: { kind: 'personNote' }, name: 'Name' }
			])
		).toThrow();
	});
});

describe('filterOf', () => {
	it('reads a view without conditions as covering everything', () => {
		expect(filterOf(view('a', 'Adressliste'))).toEqual([]);
	});
});

describe('isExportViewNameDefined', () => {
	it('matches the trimmed name within the same level and Event', () => {
		const views = { a: view('a', 'Adressliste'), b: view('b', 'Gästeliste', 'participant', 'ev1') };

		expect(isExportViewNameDefined(views, 'person', undefined, ' Adressliste ')).toBe(true);
		expect(isExportViewNameDefined(views, 'participant', 'ev1', 'Adressliste')).toBe(false);
		expect(isExportViewNameDefined(views, 'participant', 'ev2', 'Gästeliste')).toBe(false);
	});
});

describe('listExportViews', () => {
	it('lists the Export Views of one level and Event, sorted by name', () => {
		const views = {
			a: view('a', 'Zusagen', 'participant', 'ev1'),
			b: view('b', 'Gästeliste', 'participant', 'ev1'),
			c: view('c', 'Andere', 'participant', 'ev2'),
			d: view('d', 'Adressliste')
		};

		expect(listExportViews(views, 'participant', 'ev1').map((entry) => entry.name)).toEqual([
			'Gästeliste',
			'Zusagen'
		]);
		expect(listExportViews(views, 'person', undefined).map((entry) => entry.name)).toEqual([
			'Adressliste'
		]);
	});
});

describe('unresolvedColumnNames', () => {
	it('names the columns whose Custom Field is gone', () => {
		const definitions: Record<string, CustomFieldDefinition> = {
			cf1: { id: 'cf1', level: 'person', type: 'text', name: 'Verein' }
		};
		const withFields: ExportView = {
			...view('a', 'Adressliste'),
			columns: [
				nameColumn,
				{ source: { kind: 'personField', definitionId: 'cf1' }, name: 'Verein' },
				{ source: { kind: 'personField', definitionId: 'gone' }, name: 'Zimmer' }
			]
		};

		expect(unresolvedColumnNames(withFields, definitions)).toEqual(['Zimmer']);
	});
});

// One Event with two Roles and both Custom Field levels; Ada takes part with
// two Roles and values on both levels, Grace with none of either. Kurt is an
// orphan Person outside the Event.
function libraryWithParticipants(): Library {
	const library = createEmptyLibrary();
	library.events['ev1'] = { id: 'ev1', name: 'Sommerfest' };
	library.persons['ada'] = {
		id: 'ada',
		name: 'Ada Lovelace',
		note: 'kommt später',
		customValues: { cf1: 'SV Nord' }
	};
	library.persons['grace'] = { id: 'grace', name: 'Grace Hopper' };
	library.persons['kurt'] = { id: 'kurt', name: 'Kurt Gödel' };
	library.participants['pa1'] = {
		id: 'pa1',
		event: 'ev1',
		person: 'ada',
		roles: ['ro2', 'ro1'],
		note: 'Allergie: Nüsse',
		customValues: { cf2: '12' }
	};
	library.participants['pa2'] = { id: 'pa2', event: 'ev1', person: 'grace', roles: [] };
	library.participants['pa3'] = { id: 'pa3', event: 'ev2', person: 'kurt', roles: [] };
	library.roles['ro1'] = { id: 'ro1', event: 'ev1', name: 'Gast' };
	library.roles['ro2'] = { id: 'ro2', event: 'ev1', name: 'Helferin' };
	library.customFields['cf1'] = { id: 'cf1', level: 'person', type: 'text', name: 'Verein' };
	library.customFields['cf2'] = {
		id: 'cf2',
		level: 'participant',
		type: 'text',
		event: 'ev1',
		name: 'Zimmer'
	};
	return library;
}

describe('projectExportView', () => {
	it('projects every Person, sorted by name, into the chosen columns', () => {
		const library = libraryWithParticipants();
		const personView: ExportView = {
			...view('a', 'Adressliste'),
			columns: [
				{ source: { kind: 'personName' }, name: 'Voller Name' },
				{ source: { kind: 'personField', definitionId: 'cf1' }, name: 'Verein' },
				{ source: { kind: 'personNote' }, name: 'Notiz' }
			]
		};

		expect(projectExportView(library, personView)).toEqual({
			columns: ['Voller Name', 'Verein', 'Notiz'],
			rows: [
				['Ada Lovelace', 'SV Nord', 'kommt später'],
				['Grace Hopper', '', ''],
				['Kurt Gödel', '', '']
			]
		});
	});

	it('projects only the Event’s Participants and can draw on the Person', () => {
		const library = libraryWithParticipants();
		const participantView: ExportView = {
			...view('a', 'Gästeliste', 'participant', 'ev1'),
			columns: [
				{ source: { kind: 'personName' }, name: 'Name' },
				{ source: { kind: 'personField', definitionId: 'cf1' }, name: 'Verein' },
				{ source: { kind: 'participantField', definitionId: 'cf2' }, name: 'Zimmer' },
				{ source: { kind: 'participantNote' }, name: 'Notiz' }
			]
		};

		expect(projectExportView(library, participantView)).toEqual({
			columns: ['Name', 'Verein', 'Zimmer', 'Notiz'],
			rows: [
				['Ada Lovelace', 'SV Nord', '12', 'Allergie: Nüsse'],
				['Grace Hopper', '', '', '']
			]
		});
	});

	it('writes the Roles of a Participant into one column, in the Event’s Role order', () => {
		const library = libraryWithParticipants();
		const roleView: ExportView = {
			...view('a', 'Rollenliste', 'participant', 'ev1'),
			columns: [
				{ source: { kind: 'personName' }, name: 'Name' },
				{ source: { kind: 'roles' }, name: 'Rollen' }
			]
		};

		expect(projectExportView(library, roleView).rows).toEqual([
			['Ada Lovelace', 'Gast, Helferin'],
			['Grace Hopper', '']
		]);
	});

	it('leaves a column whose Custom Field is gone empty', () => {
		const library = libraryWithParticipants();
		const staleView: ExportView = {
			...view('a', 'Adressliste'),
			columns: [
				{ source: { kind: 'personName' }, name: 'Name' },
				{ source: { kind: 'personField', definitionId: 'gone' }, name: 'Zimmer' }
			]
		};

		expect(projectExportView(library, staleView).rows[0]).toEqual(['Ada Lovelace', '']);
	});

	it('yields the header row alone for a level without records', () => {
		const library = createEmptyLibrary();

		expect(projectExportView(library, view('a', 'Adressliste'))).toEqual({
			columns: ['Name'],
			rows: []
		});
	});

	it('writes only the Persons the filter matches', () => {
		const library = libraryWithParticipants();
		const filteredView: ExportView = {
			...view('a', 'Vereinsliste'),
			filter: [{ kind: 'field', definitionId: 'cf1', test: { kind: 'notEmpty' } }]
		};

		expect(projectExportView(library, filteredView).rows).toEqual([['Ada Lovelace']]);
	});

	it('writes only the Participants the filter matches', () => {
		const library = libraryWithParticipants();
		const filteredView: ExportView = {
			...view('a', 'Helferliste', 'participant', 'ev1'),
			filter: [
				{ kind: 'role', roleId: 'ro2', holds: true },
				{ kind: 'field', definitionId: 'cf2', test: { kind: 'equals', value: '12' } }
			]
		};

		expect(projectExportView(library, filteredView).rows).toEqual([['Ada Lovelace']]);
	});
});

describe('previewFilter', () => {
	it('counts the matching Persons and names the first of them', () => {
		const library = libraryWithParticipants();
		const conditions: FilterCondition[] = [
			{ kind: 'field', definitionId: 'cf1', test: { kind: 'notEmpty' } }
		];

		expect(previewFilter(library, 'person', undefined, conditions)).toEqual({
			matching: 1,
			total: 3,
			sampleNames: ['Ada Lovelace']
		});
	});

	it('counts the Participants of the Event alone', () => {
		const library = libraryWithParticipants();

		expect(previewFilter(library, 'participant', 'ev1', [])).toEqual({
			matching: 2,
			total: 2,
			sampleNames: ['Ada Lovelace', 'Grace Hopper']
		});
	});

	it('narrows the count as conditions are added', () => {
		const library = libraryWithParticipants();
		const conditions: FilterCondition[] = [{ kind: 'role', roleId: 'ro1', holds: false }];

		expect(previewFilter(library, 'participant', 'ev1', conditions)).toEqual({
			matching: 1,
			total: 2,
			sampleNames: ['Grace Hopper']
		});
	});
});

describe('exportFileName', () => {
	it('builds a CSV file name from the Export View name', () => {
		expect(exportFileName(view('a', 'Gästeliste 2026'))).toBe('Gästeliste-2026.csv');
	});

	it('falls back when the name has nothing to build on', () => {
		expect(exportFileName(view('a', '«»'))).toBe('Export-Ansicht.csv');
	});
});
