import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import type { CustomFieldDefinition } from './custom-field';
import type { FilterCondition } from './export-filter';
import {
	copyExportViewToEvent,
	defineExportView,
	exportFileName,
	filterOf,
	isExportViewNameDefined,
	listExportViews,
	previewFilter,
	projectExportView,
	renameExportView,
	unresolvedColumnNames,
	updateExportViewColumns,
	updateExportViewFilter,
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

describe('renameExportView', () => {
	it('renames an Export View, trimmed', () => {
		const existing = view('a', 'Adressliste');

		expect(renameExportView({ a: existing }, existing, '  Vereinsliste ').name).toBe('Vereinsliste');
	});

	it('allows an Export View its own current name', () => {
		const existing = view('a', 'Adressliste');

		expect(renameExportView({ a: existing }, existing, 'Adressliste').name).toBe('Adressliste');
	});

	it('rejects a name another Export View of the same level and Event holds', () => {
		const existing = view('a', 'Adressliste');
		const views = { a: existing, b: view('b', 'Vereinsliste') };

		expect(() => renameExportView(views, existing, 'Vereinsliste')).toThrow();
	});

	it('allows a name held at another level or in another Event', () => {
		const existing = view('a', 'Adressliste');
		const views = { a: existing, b: view('b', 'Vereinsliste', 'participant', 'ev1') };

		expect(renameExportView(views, existing, 'Vereinsliste').name).toBe('Vereinsliste');
	});

	it('rejects a blank name', () => {
		const existing = view('a', 'Adressliste');

		expect(() => renameExportView({ a: existing }, existing, '   ')).toThrow();
	});

	it('keeps the columns and the filter', () => {
		const filtered: ExportView = {
			...view('a', 'Adressliste'),
			filter: [{ kind: 'field', definitionId: 'cf1', test: { kind: 'notEmpty' } }]
		};

		const renamed = renameExportView({ a: filtered }, filtered, 'Vereinsliste');

		expect(renamed.columns).toEqual(filtered.columns);
		expect(renamed.filter).toEqual(filtered.filter);
	});
});

describe('updateExportViewColumns', () => {
	it('replaces the columns, trimmed', () => {
		const columns: ExportColumn[] = [
			nameColumn,
			{ source: { kind: 'personNote' }, name: '  Notiz ' }
		];

		const updated = updateExportViewColumns(view('a', 'Adressliste'), columns);

		expect(updated.columns).toEqual([nameColumn, { source: { kind: 'personNote' }, name: 'Notiz' }]);
	});

	it('keeps the name, the level and the filter', () => {
		const filtered: ExportView = {
			...view('a', 'Gästeliste', 'participant', 'ev1'),
			filter: [{ kind: 'role', roleId: 'ro1', holds: true }]
		};

		const updated = updateExportViewColumns(filtered, [nameColumn]);

		expect(updated.name).toBe('Gästeliste');
		expect(updated.event).toBe('ev1');
		expect(updated.filter).toEqual([{ kind: 'role', roleId: 'ro1', holds: true }]);
	});

	it('rejects repeated output column names', () => {
		const columns: ExportColumn[] = [nameColumn, { source: { kind: 'personNote' }, name: 'Name' }];

		expect(() => updateExportViewColumns(view('a', 'Adressliste'), columns)).toThrow();
	});

	it('rejects dropping the last column', () => {
		expect(() => updateExportViewColumns(view('a', 'Adressliste'), [])).toThrow();
	});
});

describe('updateExportViewFilter', () => {
	it('sets the conditions, normalized', () => {
		const conditions: FilterCondition[] = [
			{ kind: 'field', definitionId: 'cf1', test: { kind: 'equals', value: ' SV Nord ' } }
		];

		const updated = updateExportViewFilter(view('a', 'Adressliste'), conditions);

		expect(updated.filter).toEqual([
			{ kind: 'field', definitionId: 'cf1', test: { kind: 'equals', value: 'SV Nord' } }
		]);
	});

	it('drops the filter when the last condition is removed', () => {
		const filtered: ExportView = {
			...view('a', 'Adressliste'),
			filter: [{ kind: 'field', definitionId: 'cf1', test: { kind: 'notEmpty' } }]
		};

		const updated = updateExportViewFilter(filtered, []);

		expect('filter' in updated).toBe(false);
	});

	it('keeps the id, the columns and the Event', () => {
		const participantView = view('a', 'Gästeliste', 'participant', 'ev1');

		const updated = updateExportViewFilter(participantView, [
			{ kind: 'role', roleId: 'ro1', holds: false }
		]);

		expect(updated.id).toBe('a');
		expect(updated.event).toBe('ev1');
		expect(updated.columns).toEqual([nameColumn]);
	});

	it('rejects a condition comparing against a blank value', () => {
		const conditions: FilterCondition[] = [
			{ kind: 'field', definitionId: 'cf1', test: { kind: 'equals', value: '  ' } }
		];

		expect(() => updateExportViewFilter(view('a', 'Adressliste'), conditions)).toThrow();
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

	it('names a column whose Teilnehmer-Feld belongs to another Event', () => {
		const definitions: Record<string, CustomFieldDefinition> = {
			cf2: { id: 'cf2', level: 'participant', event: 'ev1', type: 'text', name: 'Zimmer' }
		};
		const copied: ExportView = {
			...view('a', 'Küchenliste', 'participant', 'ev2'),
			columns: [{ source: { kind: 'participantField', definitionId: 'cf2' }, name: 'Zimmer' }]
		};

		expect(unresolvedColumnNames(copied, definitions)).toEqual(['Zimmer']);
	});

	it('leaves a global Person-Feld resolved in a Participant-level view', () => {
		const definitions: Record<string, CustomFieldDefinition> = {
			cf1: { id: 'cf1', level: 'person', type: 'text', name: 'Verein' }
		};
		const participantView: ExportView = {
			...view('a', 'Gästeliste', 'participant', 'ev1'),
			columns: [{ source: { kind: 'personField', definitionId: 'cf1' }, name: 'Verein' }]
		};

		expect(unresolvedColumnNames(participantView, definitions)).toEqual([]);
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

// Two Events whose vocabularies overlap: „Zimmer“ and „Gast“ exist in both,
// „Charaktername“ and „Helferin“ only in the source Event. Ada takes part in
// the target Event alone.
function libraryWithTwoEvents(): Library {
	const library = createEmptyLibrary();
	library.events['ev1'] = { id: 'ev1', name: 'Sommerfest' };
	library.events['ev2'] = { id: 'ev2', name: 'Winterlager' };
	library.persons['ada'] = { id: 'ada', name: 'Ada Lovelace', customValues: { cf1: 'SV Nord' } };
	library.participants['pa1'] = {
		id: 'pa1',
		event: 'ev2',
		person: 'ada',
		roles: ['ro3'],
		customValues: { cf4: '7' }
	};
	library.roles['ro1'] = { id: 'ro1', event: 'ev1', name: 'Gast' };
	library.roles['ro2'] = { id: 'ro2', event: 'ev1', name: 'Helferin' };
	library.roles['ro3'] = { id: 'ro3', event: 'ev2', name: 'Gast' };
	library.customFields['cf1'] = { id: 'cf1', level: 'person', type: 'text', name: 'Verein' };
	library.customFields['cf2'] = {
		id: 'cf2',
		level: 'participant',
		event: 'ev1',
		type: 'text',
		name: 'Zimmer'
	};
	library.customFields['cf3'] = {
		id: 'cf3',
		level: 'participant',
		event: 'ev1',
		type: 'text',
		name: 'Charaktername'
	};
	library.customFields['cf4'] = {
		id: 'cf4',
		level: 'participant',
		event: 'ev2',
		type: 'text',
		name: 'Zimmer'
	};
	return library;
}

function kitchenList(): ExportView {
	return {
		id: 'v1',
		name: 'Küchenliste',
		level: 'participant',
		event: 'ev1',
		filter: [
			{ kind: 'role', roleId: 'ro1', holds: true },
			{ kind: 'field', definitionId: 'cf1', test: { kind: 'equals', value: 'SV Nord' } },
			{ kind: 'field', definitionId: 'cf3', test: { kind: 'notEmpty' } },
			{ kind: 'role', roleId: 'ro2', holds: true }
		],
		columns: [
			{ source: { kind: 'personName' }, name: 'Name' },
			{ source: { kind: 'personField', definitionId: 'cf1' }, name: 'Verein' },
			{ source: { kind: 'participantField', definitionId: 'cf2' }, name: 'Zimmer' },
			{ source: { kind: 'participantField', definitionId: 'cf3' }, name: 'Charakter' },
			{ source: { kind: 'roles' }, name: 'Rollen' }
		]
	};
}

describe('copyExportViewToEvent', () => {
	it('re-points the columns at the Teilnehmer-Felder of the target Event, matched by name', () => {
		const library = libraryWithTwoEvents();

		const copy = copyExportViewToEvent(library, kitchenList(), 'ev2');

		expect(copy.view.event).toBe('ev2');
		expect(copy.view.name).toBe('Küchenliste');
		expect(uuidValidate(copy.view.id)).toBe(true);
		expect(uuidVersion(copy.view.id)).toBe(7);
		expect(copy.view.columns).toEqual([
			{ source: { kind: 'personName' }, name: 'Name' },
			{ source: { kind: 'personField', definitionId: 'cf1' }, name: 'Verein' },
			{ source: { kind: 'participantField', definitionId: 'cf4' }, name: 'Zimmer' },
			{ source: { kind: 'participantField', definitionId: 'cf3' }, name: 'Charakter' },
			{ source: { kind: 'roles' }, name: 'Rollen' }
		]);
	});

	it('re-points the conditions by name and drops those without a counterpart', () => {
		const library = libraryWithTwoEvents();

		const copy = copyExportViewToEvent(library, kitchenList(), 'ev2');

		expect(copy.view.filter).toEqual([
			{ kind: 'role', roleId: 'ro3', holds: true },
			{ kind: 'field', definitionId: 'cf1', test: { kind: 'equals', value: 'SV Nord' } }
		]);
	});

	it('reports the kept columns and the dropped conditions', () => {
		const library = libraryWithTwoEvents();

		const copy = copyExportViewToEvent(library, kitchenList(), 'ev2');

		expect(copy.unmatched).toEqual([
			{
				kind: 'column',
				column: { source: { kind: 'participantField', definitionId: 'cf3' }, name: 'Charakter' }
			},
			{
				kind: 'condition',
				condition: { kind: 'field', definitionId: 'cf3', test: { kind: 'notEmpty' } }
			},
			{ kind: 'condition', condition: { kind: 'role', roleId: 'ro2', holds: true } }
		]);
	});

	it('reports the same parts on every call, so the report and the act cannot disagree', () => {
		const library = libraryWithTwoEvents();

		const reported = copyExportViewToEvent(library, kitchenList(), 'ev2');
		const committed = copyExportViewToEvent(library, kitchenList(), 'ev2');

		expect(committed.unmatched).toEqual(reported.unmatched);
		expect(committed.view.columns).toEqual(reported.view.columns);
		expect(committed.view.filter).toEqual(reported.view.filter);
	});

	it('exports the kept column empty and marks it as unresolved', () => {
		const library = libraryWithTwoEvents();

		const copy = copyExportViewToEvent(library, kitchenList(), 'ev2');

		expect(projectExportView(library, copy.view)).toEqual({
			columns: ['Name', 'Verein', 'Zimmer', 'Charakter', 'Rollen'],
			rows: [['Ada Lovelace', 'SV Nord', '7', '', 'Gast']]
		});
		expect(unresolvedColumnNames(copy.view, library.customFields)).toEqual(['Charakter']);
	});

	it('drops a condition whose Custom Field is gone', () => {
		const library = libraryWithTwoEvents();
		const stale: ExportView = {
			...kitchenList(),
			filter: [{ kind: 'field', definitionId: 'gone', test: { kind: 'notEmpty' } }]
		};

		const copy = copyExportViewToEvent(library, stale, 'ev2');

		expect(copy.view.filter).toBeUndefined();
		expect(copy.unmatched).toContainEqual({
			kind: 'condition',
			condition: { kind: 'field', definitionId: 'gone', test: { kind: 'notEmpty' } }
		});
	});

	it('rejects a Person-level Export View', () => {
		const library = libraryWithTwoEvents();

		expect(() => copyExportViewToEvent(library, view('a', 'Adressliste'), 'ev2')).toThrow();
	});

	it('rejects a name the target Event already holds', () => {
		const library = libraryWithTwoEvents();
		library.exportViews['v9'] = { ...kitchenList(), id: 'v9', event: 'ev2' };

		expect(() => copyExportViewToEvent(library, kitchenList(), 'ev2')).toThrow();
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
