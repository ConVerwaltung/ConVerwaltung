import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import {
	changeCustomFieldType,
	countCustomValues,
	customValueOf,
	defineParticipantField,
	definePersonField,
	editCustomValue,
	editSelectOptions,
	isParticipantFieldNameDefined,
	isPersonFieldNameDefined,
	isValidCustomValue,
	listParticipantFields,
	listPersonFields,
	listUsedCustomValues,
	parseSelectOptions,
	removeCustomFieldDefinition,
	renameCustomField,
	type CustomFieldDefinition,
	type CustomFieldType
} from './custom-field';
import { addParticipant, type Participant } from './participant';
import { createPerson } from './person';

function personField(id: string, name: string, type: CustomFieldType = 'text'): CustomFieldDefinition {
	return { id, level: 'person', type, name };
}

function participantField(id: string, eventId: string, name: string): CustomFieldDefinition {
	return { id, level: 'participant', type: 'text', event: eventId, name };
}

function selectField(id: string, name: string, options: readonly string[]): CustomFieldDefinition {
	return { id, level: 'person', type: 'select', name, selectOptions: options };
}

describe('definePersonField', () => {
	it('creates a Person-level text definition with a UUID v7 id', () => {
		const definition = definePersonField({}, 'E-Mail', 'text');

		expect(definition.level).toBe('person');
		expect(definition.type).toBe('text');
		expect(definition.name).toBe('E-Mail');
		expect(definition.selectOptions).toBeUndefined();
		expect(uuidValidate(definition.id)).toBe(true);
		expect(uuidVersion(definition.id)).toBe(7);
	});

	it('creates number, boolean, and date definitions', () => {
		expect(definePersonField({}, 'Beitrag', 'number').type).toBe('number');
		expect(definePersonField({}, 'Vegetarisch', 'boolean').type).toBe('boolean');
		expect(definePersonField({}, 'Geburtstag', 'date').type).toBe('date');
	});

	it('creates a single-select definition carrying its options', () => {
		const definition = definePersonField({}, 'Verein', 'select', ['SV Nord', 'SV Süd']);

		expect(definition.type).toBe('select');
		expect(definition.selectOptions).toEqual(['SV Nord', 'SV Süd']);
	});

	it('normalizes single-select options: trims, drops blanks and duplicates', () => {
		const definition = definePersonField({}, 'Verein', 'select', [
			'  SV Nord ',
			'',
			'SV Süd',
			'SV Nord'
		]);

		expect(definition.selectOptions).toEqual(['SV Nord', 'SV Süd']);
	});

	it('rejects a single-select definition without options', () => {
		expect(() => definePersonField({}, 'Verein', 'select')).toThrow();
		expect(() => definePersonField({}, 'Verein', 'select', ['  ', ''])).toThrow();
	});

	it('rejects options on a non-select type', () => {
		expect(() => definePersonField({}, 'Beitrag', 'number', ['1', '2'])).toThrow();
	});

	it('trims surrounding whitespace from the name', () => {
		expect(definePersonField({}, '  E-Mail  ', 'text').name).toBe('E-Mail');
	});

	it('rejects a blank name', () => {
		expect(() => definePersonField({}, '', 'text')).toThrow();
		expect(() => definePersonField({}, '   ', 'text')).toThrow();
	});

	it('rejects a duplicate name, also after trimming', () => {
		const existing = personField('field-1', 'E-Mail');
		const definitions = { [existing.id]: existing };

		expect(() => definePersonField(definitions, 'E-Mail', 'text')).toThrow();
		expect(() => definePersonField(definitions, '  E-Mail  ', 'text')).toThrow();
	});
});

describe('isPersonFieldNameDefined', () => {
	it('matches only Person-level definitions', () => {
		const tableNumber = participantField('field-1', 'event-1', 'Tischnummer');

		expect(isPersonFieldNameDefined({ [tableNumber.id]: tableNumber }, 'Tischnummer')).toBe(false);
	});
});

describe('defineParticipantField', () => {
	it('creates a Participant-level definition scoped to the Event, with a UUID v7 id', () => {
		const definition = defineParticipantField({}, 'event-1', 'Tischnummer', 'number');

		expect(definition.level).toBe('participant');
		expect(definition.type).toBe('number');
		expect(definition.event).toBe('event-1');
		expect(definition.name).toBe('Tischnummer');
		expect(uuidValidate(definition.id)).toBe(true);
		expect(uuidVersion(definition.id)).toBe(7);
	});

	it('creates a single-select definition carrying its options', () => {
		const definition = defineParticipantField({}, 'event-1', 'Schicht', 'select', ['Früh', 'Spät']);

		expect(definition.selectOptions).toEqual(['Früh', 'Spät']);
	});

	it('rejects a single-select definition without options', () => {
		expect(() => defineParticipantField({}, 'event-1', 'Schicht', 'select')).toThrow();
	});

	it('trims surrounding whitespace from the name', () => {
		expect(defineParticipantField({}, 'event-1', '  Tischnummer  ', 'text').name).toBe(
			'Tischnummer'
		);
	});

	it('rejects a blank name', () => {
		expect(() => defineParticipantField({}, 'event-1', '', 'text')).toThrow();
		expect(() => defineParticipantField({}, 'event-1', '   ', 'text')).toThrow();
	});

	it('rejects a duplicate name within the same Event, also after trimming', () => {
		const existing = participantField('field-1', 'event-1', 'Tischnummer');
		const definitions = { [existing.id]: existing };

		expect(() => defineParticipantField(definitions, 'event-1', 'Tischnummer', 'text')).toThrow();
		expect(() =>
			defineParticipantField(definitions, 'event-1', '  Tischnummer  ', 'text')
		).toThrow();
	});

	it('allows the same name in another Event', () => {
		const existing = participantField('field-1', 'event-1', 'Tischnummer');

		const definition = defineParticipantField(
			{ [existing.id]: existing },
			'event-2',
			'Tischnummer',
			'text'
		);

		expect(definition.event).toBe('event-2');
	});

	it('allows the name of a Person-level field', () => {
		const global = personField('field-1', 'E-Mail');

		expect(
			defineParticipantField({ [global.id]: global }, 'event-1', 'E-Mail', 'text').name
		).toBe('E-Mail');
	});
});

describe('isParticipantFieldNameDefined', () => {
	it('matches only the given Event and level', () => {
		const tableNumber = participantField('field-1', 'event-1', 'Tischnummer');
		const email = personField('field-2', 'E-Mail');
		const definitions = { [tableNumber.id]: tableNumber, [email.id]: email };

		expect(isParticipantFieldNameDefined(definitions, 'event-1', 'Tischnummer')).toBe(true);
		expect(isParticipantFieldNameDefined(definitions, 'event-2', 'Tischnummer')).toBe(false);
		expect(isParticipantFieldNameDefined(definitions, 'event-1', 'E-Mail')).toBe(false);
	});
});

describe('parseSelectOptions', () => {
	it('splits one option per line, trimming and dropping blanks and duplicates', () => {
		expect(parseSelectOptions('  SV Nord \n\nSV Süd\nSV Nord\n   ')).toEqual([
			'SV Nord',
			'SV Süd'
		]);
	});

	it('parses empty text to no options', () => {
		expect(parseSelectOptions('')).toEqual([]);
	});
});

describe('renameCustomField', () => {
	it('renames the definition', () => {
		const definition = personField('field-1', 'E-Mail');

		const renamed = renameCustomField({ [definition.id]: definition }, definition, 'Telefon');

		expect(renamed).toEqual({ ...definition, name: 'Telefon' });
	});

	it('allows keeping the current name', () => {
		const definition = personField('field-1', 'E-Mail');

		const renamed = renameCustomField({ [definition.id]: definition }, definition, 'E-Mail');

		expect(renamed.name).toBe('E-Mail');
	});

	it('rejects the name of another definition', () => {
		const email = personField('field-1', 'E-Mail');
		const phone = personField('field-2', 'Telefon');
		const definitions = { [email.id]: email, [phone.id]: phone };

		expect(() => renameCustomField(definitions, phone, 'E-Mail')).toThrow();
	});

	it('scopes Participant-level duplicates to the definition’s Event', () => {
		const tableNumber = participantField('field-1', 'event-1', 'Tischnummer');
		const room = participantField('field-2', 'event-1', 'Zimmer');
		const otherEventRoom = participantField('field-3', 'event-2', 'Zimmer');
		const definitions = {
			[tableNumber.id]: tableNumber,
			[room.id]: room,
			[otherEventRoom.id]: otherEventRoom
		};

		expect(() => renameCustomField(definitions, tableNumber, 'Zimmer')).toThrow();
		expect(renameCustomField(definitions, otherEventRoom, 'Tischnummer').name).toBe('Tischnummer');
	});
});

describe('changeCustomFieldType', () => {
	it('changes the type while no record carries a value', () => {
		const definition = personField('field-1', 'Beitrag');

		const changed = changeCustomFieldType({}, definition, 'number');

		expect(changed).toEqual({ ...definition, type: 'number' });
	});

	it('keeps the Event of a Participant-level definition', () => {
		const definition = participantField('field-1', 'event-1', 'Tischnummer');

		const changed = changeCustomFieldType({}, definition, 'number');

		expect(changed.event).toBe('event-1');
	});

	it('is blocked while a record carries a value', () => {
		const definition = personField('field-1', 'Beitrag');
		const valued = editCustomValue(createPerson('Ada Lovelace'), definition, '42');
		const persons = { [valued.id]: valued };

		expect(() => changeCustomFieldType(persons, definition, 'number')).toThrow();
	});

	it('is allowed again after the values are cleared', () => {
		const definition = personField('field-1', 'Beitrag');
		const valued = editCustomValue(createPerson('Ada Lovelace'), definition, '42');
		const cleared = editCustomValue(valued, definition, '');
		const persons = { [cleared.id]: cleared };

		expect(changeCustomFieldType(persons, definition, 'number').type).toBe('number');
	});

	it('requires options when switching to single-select', () => {
		const definition = personField('field-1', 'Verein');

		expect(() => changeCustomFieldType({}, definition, 'select')).toThrow();
		expect(changeCustomFieldType({}, definition, 'select', ['SV Nord']).selectOptions).toEqual([
			'SV Nord'
		]);
	});

	it('drops the options when switching away from single-select', () => {
		const definition = selectField('field-1', 'Verein', ['SV Nord']);

		const changed = changeCustomFieldType({}, definition, 'text');

		expect(changed.type).toBe('text');
		expect(changed.selectOptions).toBeUndefined();
	});
});

describe('editSelectOptions', () => {
	it('replaces the options, normalized', () => {
		const definition = selectField('field-1', 'Verein', ['SV Nord']);

		const edited = editSelectOptions({}, definition, [' SV Nord ', 'SV Süd', 'SV Süd']);

		expect(edited.selectOptions).toEqual(['SV Nord', 'SV Süd']);
	});

	it('allows removing an option no record carries as its value', () => {
		const definition = selectField('field-1', 'Verein', ['SV Nord', 'SV Süd']);
		const valued = editCustomValue(createPerson('Ada Lovelace'), definition, 'SV Nord');
		const persons = { [valued.id]: valued };

		expect(editSelectOptions(persons, definition, ['SV Nord']).selectOptions).toEqual(['SV Nord']);
	});

	it('blocks removing an option still recorded as a value', () => {
		const definition = selectField('field-1', 'Verein', ['SV Nord', 'SV Süd']);
		const valued = editCustomValue(createPerson('Ada Lovelace'), definition, 'SV Süd');
		const persons = { [valued.id]: valued };

		expect(() => editSelectOptions(persons, definition, ['SV Nord'])).toThrow();
	});

	it('rejects an empty option list', () => {
		const definition = selectField('field-1', 'Verein', ['SV Nord']);

		expect(() => editSelectOptions({}, definition, [])).toThrow();
	});

	it('rejects a non-select definition', () => {
		const definition = personField('field-1', 'E-Mail');

		expect(() => editSelectOptions({}, definition, ['SV Nord'])).toThrow();
	});
});

describe('listPersonFields', () => {
	it('lists only Person-level definitions in creation order', () => {
		const second = personField('field-2', 'Telefon');
		const first = personField('field-1', 'E-Mail');
		const tableNumber = participantField('field-0', 'event-1', 'Tischnummer');
		const definitions = {
			[second.id]: second,
			[first.id]: first,
			[tableNumber.id]: tableNumber
		};

		expect(listPersonFields(definitions)).toEqual([first, second]);
	});
});

describe('listParticipantFields', () => {
	it('lists only the given Event’s definitions in creation order', () => {
		const second = participantField('field-2', 'event-1', 'Zimmer');
		const first = participantField('field-1', 'event-1', 'Tischnummer');
		const otherEvent = participantField('field-0', 'event-2', 'Tischnummer');
		const global = personField('field-3', 'E-Mail');
		const definitions = {
			[second.id]: second,
			[first.id]: first,
			[otherEvent.id]: otherEvent,
			[global.id]: global
		};

		expect(listParticipantFields(definitions, 'event-1')).toEqual([first, second]);
	});
});

describe('isValidCustomValue', () => {
	it('accepts empty for every type — it clears the value', () => {
		expect(isValidCustomValue(personField('f', 'A', 'text'), '')).toBe(true);
		expect(isValidCustomValue(personField('f', 'A', 'number'), '')).toBe(true);
		expect(isValidCustomValue(personField('f', 'A', 'boolean'), '')).toBe(true);
		expect(isValidCustomValue(personField('f', 'A', 'date'), '')).toBe(true);
		expect(isValidCustomValue(selectField('f', 'A', ['x']), '')).toBe(true);
	});

	it('accepts any text for a text field', () => {
		expect(isValidCustomValue(personField('f', 'A', 'text'), 'anything at all')).toBe(true);
	});

	it('validates numbers: finite decimal text only', () => {
		const definition = personField('f', 'A', 'number');

		expect(isValidCustomValue(definition, '42')).toBe(true);
		expect(isValidCustomValue(definition, '-3.5')).toBe(true);
		expect(isValidCustomValue(definition, 'abc')).toBe(false);
		expect(isValidCustomValue(definition, '   ')).toBe(false);
		expect(isValidCustomValue(definition, 'Infinity')).toBe(false);
	});

	it("validates booleans: 'true' or 'false' only", () => {
		const definition = personField('f', 'A', 'boolean');

		expect(isValidCustomValue(definition, 'true')).toBe(true);
		expect(isValidCustomValue(definition, 'false')).toBe(true);
		expect(isValidCustomValue(definition, 'ja')).toBe(false);
		expect(isValidCustomValue(definition, 'True')).toBe(false);
	});

	it('validates dates: ISO YYYY-MM-DD naming a real calendar day', () => {
		const definition = personField('f', 'A', 'date');

		expect(isValidCustomValue(definition, '2026-07-04')).toBe(true);
		expect(isValidCustomValue(definition, '2024-02-29')).toBe(true);
		expect(isValidCustomValue(definition, '2026-02-30')).toBe(false);
		expect(isValidCustomValue(definition, '2026-13-01')).toBe(false);
		expect(isValidCustomValue(definition, '04.07.2026')).toBe(false);
		expect(isValidCustomValue(definition, '2026-7-4')).toBe(false);
	});

	it("validates single-select: only the definition's options", () => {
		const definition = selectField('f', 'A', ['SV Nord', 'SV Süd']);

		expect(isValidCustomValue(definition, 'SV Nord')).toBe(true);
		expect(isValidCustomValue(definition, 'SV Ost')).toBe(false);
	});
});

describe('editCustomValue', () => {
	const email = personField('field-1', 'E-Mail');
	const phone = personField('field-2', 'Telefon');

	it('records a value against the definition; absent reads as empty', () => {
		const person = createPerson('Ada Lovelace');
		expect(customValueOf(person, email.id)).toBe('');

		const valued = editCustomValue(person, email, 'ada@example.org');

		expect(customValueOf(valued, email.id)).toBe('ada@example.org');
	});

	it('clears the value with empty text', () => {
		const valued = editCustomValue(createPerson('Ada Lovelace'), email, 'ada@example.org');

		const cleared = editCustomValue(valued, email, '');

		expect(customValueOf(cleared, email.id)).toBe('');
		expect(cleared.customValues).toEqual({});
	});

	it('does not mutate the given record and keeps other values', () => {
		const valued = editCustomValue(createPerson('Ada Lovelace'), email, 'ada@example.org');

		const updated = editCustomValue(valued, phone, '+44 20 1234');

		expect(customValueOf(valued, phone.id)).toBe('');
		expect(customValueOf(updated, email.id)).toBe('ada@example.org');
		expect(customValueOf(updated, phone.id)).toBe('+44 20 1234');
	});

	it('rejects a value that does not fit the type', () => {
		const person = createPerson('Ada Lovelace');

		expect(() => editCustomValue(person, personField('f', 'A', 'number'), 'abc')).toThrow();
		expect(() => editCustomValue(person, personField('f', 'A', 'boolean'), 'ja')).toThrow();
		expect(() => editCustomValue(person, personField('f', 'A', 'date'), '30.02.2026')).toThrow();
		expect(() => editCustomValue(person, selectField('f', 'A', ['x']), 'y')).toThrow();
	});

	it('records fitting typed values', () => {
		const person = createPerson('Ada Lovelace');
		const amount = personField('f-number', 'Beitrag', 'number');
		const birthday = personField('f-date', 'Geburtstag', 'date');

		expect(customValueOf(editCustomValue(person, amount, '42.5'), amount.id)).toBe('42.5');
		expect(customValueOf(editCustomValue(person, birthday, '1815-12-10'), birthday.id)).toBe(
			'1815-12-10'
		);
	});

	it('keeps a Person-level value with the Person in every Event context', () => {
		const person = editCustomValue(createPerson('Ada Lovelace'), email, 'ada@example.org');
		const participants: Record<string, Participant> = {};
		const firstParticipant = addParticipant(participants, 'event-1', person.id);
		participants[firstParticipant.id] = firstParticipant;
		const secondParticipant = addParticipant(participants, 'event-2', person.id);
		const persons = { [person.id]: person };

		expect(customValueOf(persons[firstParticipant.person], email.id)).toBe('ada@example.org');
		expect(customValueOf(persons[secondParticipant.person], email.id)).toBe('ada@example.org');
	});

	it('keeps Participant-level values independent per Event while Person-level values stay shared', () => {
		const summerRoom = participantField('field-room-1', 'event-1', 'Zimmer');
		const autumnRoom = participantField('field-room-2', 'event-2', 'Zimmer');
		const person = editCustomValue(createPerson('Ada Lovelace'), email, 'ada@example.org');
		const participants: Record<string, Participant> = {};
		const summerParticipant = addParticipant(participants, 'event-1', person.id);
		participants[summerParticipant.id] = summerParticipant;
		const autumnParticipant = addParticipant(participants, 'event-2', person.id);

		const summerValued = editCustomValue(summerParticipant, summerRoom, '101');
		const autumnValued = editCustomValue(autumnParticipant, autumnRoom, '205');

		expect(customValueOf(person, email.id)).toBe('ada@example.org');
		expect(customValueOf(summerValued, summerRoom.id)).toBe('101');
		expect(customValueOf(autumnValued, autumnRoom.id)).toBe('205');
		expect(customValueOf(summerValued, autumnRoom.id)).toBe('');
		expect(customValueOf(autumnValued, summerRoom.id)).toBe('');
	});
});

describe('countCustomValues', () => {
	it('counts the records carrying a value for the definition', () => {
		const definition = personField('field-1', 'E-Mail');
		const ada = editCustomValue(createPerson('Ada Lovelace'), definition, 'ada@example.org');
		const grace = editCustomValue(createPerson('Grace Hopper'), definition, 'grace@example.org');
		const kurt = createPerson('Kurt Gödel');
		const persons = { [ada.id]: ada, [grace.id]: grace, [kurt.id]: kurt };

		expect(countCustomValues(persons, definition.id)).toBe(2);
		expect(countCustomValues(persons, 'other-field')).toBe(0);
	});
});

describe('listUsedCustomValues', () => {
	it('lists the distinct values recorded against the definition, sorted', () => {
		const definition = selectField('field-1', 'Verein', ['SV Nord', 'SV Süd']);
		const ada = editCustomValue(createPerson('Ada Lovelace'), definition, 'SV Süd');
		const grace = editCustomValue(createPerson('Grace Hopper'), definition, 'SV Nord');
		const kurt = editCustomValue(createPerson('Kurt Gödel'), definition, 'SV Nord');
		const persons = { [ada.id]: ada, [grace.id]: grace, [kurt.id]: kurt };

		expect(listUsedCustomValues(persons, definition.id)).toEqual(['SV Nord', 'SV Süd']);
	});
});

describe('removeCustomFieldDefinition', () => {
	it('deletes the definition and clears its recorded values, leaving others untouched', () => {
		const email = personField('field-1', 'E-Mail');
		const phone = personField('field-2', 'Telefon');
		const ada = editCustomValue(createPerson('Ada Lovelace'), email, 'ada@example.org');
		const grace = editCustomValue(createPerson('Grace Hopper'), phone, '+1 555 0100');
		const kurt = createPerson('Kurt Gödel');
		const persons = { [ada.id]: ada, [grace.id]: grace, [kurt.id]: kurt };

		const { deletions, clearedRecords } = removeCustomFieldDefinition(persons, 'field-1');

		expect(deletions).toEqual([{ section: 'customFields', id: 'field-1' }]);
		expect(clearedRecords).toEqual([{ ...ada, customValues: {} }]);
	});

	it('clears values carried on Participants the same way', () => {
		const room = participantField('field-1', 'event-1', 'Zimmer');
		const participants: Record<string, Participant> = {};
		const plain = addParticipant(participants, 'event-1', 'ada');
		participants[plain.id] = plain;
		const valued = editCustomValue(addParticipant(participants, 'event-1', 'grace'), room, '101');

		const { deletions, clearedRecords } = removeCustomFieldDefinition(
			{ ...participants, [valued.id]: valued },
			'field-1'
		);

		expect(deletions).toEqual([{ section: 'customFields', id: 'field-1' }]);
		expect(clearedRecords).toEqual([{ ...valued, customValues: {} }]);
	});
});
