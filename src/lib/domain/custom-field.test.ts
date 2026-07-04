import { describe, expect, it } from 'vitest';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import {
	customValueOf,
	defineParticipantTextField,
	definePersonTextField,
	editCustomValue,
	isParticipantFieldNameDefined,
	isPersonFieldNameDefined,
	listParticipantFields,
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

function participantField(id: string, eventId: string, name: string): CustomFieldDefinition {
	return { id, level: 'participant', type: 'text', event: eventId, name };
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
		const tableNumber = participantField('field-1', 'event-1', 'Tischnummer');

		expect(isPersonFieldNameDefined({ [tableNumber.id]: tableNumber }, 'Tischnummer')).toBe(false);
	});
});

describe('defineParticipantTextField', () => {
	it('creates a Participant-level text definition scoped to the Event, with a UUID v7 id', () => {
		const definition = defineParticipantTextField({}, 'event-1', 'Tischnummer');

		expect(definition.level).toBe('participant');
		expect(definition.type).toBe('text');
		expect(definition.event).toBe('event-1');
		expect(definition.name).toBe('Tischnummer');
		expect(uuidValidate(definition.id)).toBe(true);
		expect(uuidVersion(definition.id)).toBe(7);
	});

	it('trims surrounding whitespace from the name', () => {
		expect(defineParticipantTextField({}, 'event-1', '  Tischnummer  ').name).toBe('Tischnummer');
	});

	it('rejects a blank name', () => {
		expect(() => defineParticipantTextField({}, 'event-1', '')).toThrow();
		expect(() => defineParticipantTextField({}, 'event-1', '   ')).toThrow();
	});

	it('rejects a duplicate name within the same Event, also after trimming', () => {
		const existing = participantField('field-1', 'event-1', 'Tischnummer');
		const definitions = { [existing.id]: existing };

		expect(() => defineParticipantTextField(definitions, 'event-1', 'Tischnummer')).toThrow();
		expect(() => defineParticipantTextField(definitions, 'event-1', '  Tischnummer  ')).toThrow();
	});

	it('allows the same name in another Event', () => {
		const existing = participantField('field-1', 'event-1', 'Tischnummer');

		const definition = defineParticipantTextField(
			{ [existing.id]: existing },
			'event-2',
			'Tischnummer'
		);

		expect(definition.event).toBe('event-2');
	});

	it('allows the name of a Person-level field', () => {
		const global = personField('field-1', 'E-Mail');

		expect(defineParticipantTextField({ [global.id]: global }, 'event-1', 'E-Mail').name).toBe(
			'E-Mail'
		);
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

	it('keeps Participant-level values independent per Event while Person-level values stay shared', () => {
		const email = personField('field-email', 'E-Mail');
		const summerRoom = participantField('field-room-1', 'event-1', 'Zimmer');
		const autumnRoom = participantField('field-room-2', 'event-2', 'Zimmer');
		const person = editCustomValue(createPerson('Ada Lovelace'), email.id, 'ada@example.org');
		const participants: Record<string, Participant> = {};
		const summerParticipant = addParticipant(participants, 'event-1', person.id);
		participants[summerParticipant.id] = summerParticipant;
		const autumnParticipant = addParticipant(participants, 'event-2', person.id);

		const summerValued = editCustomValue(summerParticipant, summerRoom.id, '101');
		const autumnValued = editCustomValue(autumnParticipant, autumnRoom.id, '205');

		expect(customValueOf(person, email.id)).toBe('ada@example.org');
		expect(customValueOf(summerValued, summerRoom.id)).toBe('101');
		expect(customValueOf(autumnValued, autumnRoom.id)).toBe('205');
		expect(customValueOf(summerValued, autumnRoom.id)).toBe('');
		expect(customValueOf(autumnValued, summerRoom.id)).toBe('');
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

	it('clears values carried on Participants the same way', () => {
		const participants: Record<string, Participant> = {};
		const plain = addParticipant(participants, 'event-1', 'ada');
		participants[plain.id] = plain;
		const valued = editCustomValue(
			addParticipant(participants, 'event-1', 'grace'),
			'field-1',
			'101'
		);

		const { deletions, clearedRecords } = removeCustomFieldDefinition(
			{ ...participants, [valued.id]: valued },
			'field-1'
		);

		expect(deletions).toEqual([{ section: 'customFields', id: 'field-1' }]);
		expect(clearedRecords).toEqual([{ ...valued, customValues: {} }]);
	});
});
