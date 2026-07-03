import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import {
	customValueOf,
	definePersonTextField,
	editCustomValue,
	isPersonFieldNameDefined,
	listPersonFields,
	removeCustomFieldDefinition,
	renameCustomField,
	type CustomFieldDefinition
} from './custom-field';
import { addParticipant, type Participant } from './participant';
import { createPerson } from './person';

function personField(id: string, name: string): CustomFieldDefinition {
	return { id, level: 'person', type: 'text', name };
}

describe('definePersonTextField', () => {
	it('creates a Person-level text definition with a UUID v7 id', () => {
		const definition = definePersonTextField({}, 'E-Mail');

		expect(definition.level).toBe('person');
		expect(definition.type).toBe('text');
		expect(definition.name).toBe('E-Mail');
		expect(uuidValidate(definition.id)).toBe(true);
		expect(uuidVersion(definition.id)).toBe(7);
	});

	it('trims surrounding whitespace from the name', () => {
		expect(definePersonTextField({}, '  E-Mail  ').name).toBe('E-Mail');
	});

	it('rejects a blank name', () => {
		expect(() => definePersonTextField({}, '')).toThrow();
		expect(() => definePersonTextField({}, '   ')).toThrow();
	});

	it('rejects a duplicate name, also after trimming', () => {
		const existing = personField('field-1', 'E-Mail');
		const definitions = { [existing.id]: existing };

		expect(() => definePersonTextField(definitions, 'E-Mail')).toThrow();
		expect(() => definePersonTextField(definitions, '  E-Mail  ')).toThrow();
	});
});

describe('isPersonFieldNameDefined', () => {
	it('matches only Person-level definitions', () => {
		const participantField: CustomFieldDefinition = {
			id: 'field-1',
			level: 'participant',
			type: 'text',
			name: 'Tischnummer'
		};

		expect(isPersonFieldNameDefined({ [participantField.id]: participantField }, 'Tischnummer')).toBe(
			false
		);
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
});

describe('listPersonFields', () => {
	it('lists only Person-level definitions in creation order', () => {
		const second = personField('field-2', 'Telefon');
		const first = personField('field-1', 'E-Mail');
		const participantField: CustomFieldDefinition = {
			id: 'field-0',
			level: 'participant',
			type: 'text',
			name: 'Tischnummer'
		};
		const definitions = {
			[second.id]: second,
			[first.id]: first,
			[participantField.id]: participantField
		};

		expect(listPersonFields(definitions)).toEqual([first, second]);
	});
});

describe('editCustomValue', () => {
	it('records a value against the definition; absent reads as empty', () => {
		const person = createPerson('Ada Lovelace');
		expect(customValueOf(person, 'field-1')).toBe('');

		const valued = editCustomValue(person, 'field-1', 'ada@example.org');

		expect(customValueOf(valued, 'field-1')).toBe('ada@example.org');
	});

	it('clears the value with empty text', () => {
		const valued = editCustomValue(createPerson('Ada Lovelace'), 'field-1', 'ada@example.org');

		const cleared = editCustomValue(valued, 'field-1', '');

		expect(customValueOf(cleared, 'field-1')).toBe('');
		expect(cleared.customValues).toEqual({});
	});

	it('does not mutate the given record and keeps other values', () => {
		const valued = editCustomValue(createPerson('Ada Lovelace'), 'field-1', 'ada@example.org');

		const updated = editCustomValue(valued, 'field-2', '+44 20 1234');

		expect(customValueOf(valued, 'field-2')).toBe('');
		expect(customValueOf(updated, 'field-1')).toBe('ada@example.org');
		expect(customValueOf(updated, 'field-2')).toBe('+44 20 1234');
	});

	it('keeps a Person-level value with the Person in every Event context', () => {
		const person = editCustomValue(createPerson('Ada Lovelace'), 'field-1', 'ada@example.org');
		const participants: Record<string, Participant> = {};
		const firstParticipant = addParticipant(participants, 'event-1', person.id);
		participants[firstParticipant.id] = firstParticipant;
		const secondParticipant = addParticipant(participants, 'event-2', person.id);
		const persons = { [person.id]: person };

		expect(customValueOf(persons[firstParticipant.person], 'field-1')).toBe('ada@example.org');
		expect(customValueOf(persons[secondParticipant.person], 'field-1')).toBe('ada@example.org');
	});
});

describe('removeCustomFieldDefinition', () => {
	it('deletes the definition and clears its recorded values, leaving others untouched', () => {
		const ada = editCustomValue(createPerson('Ada Lovelace'), 'field-1', 'ada@example.org');
		const grace = editCustomValue(createPerson('Grace Hopper'), 'field-2', '+1 555 0100');
		const kurt = createPerson('Kurt Gödel');
		const persons = { [ada.id]: ada, [grace.id]: grace, [kurt.id]: kurt };

		const { deletions, clearedRecords } = removeCustomFieldDefinition(persons, 'field-1');

		expect(deletions).toEqual([{ section: 'customFields', id: 'field-1' }]);
		expect(clearedRecords).toEqual([{ ...ada, customValues: {} }]);
	});
});
