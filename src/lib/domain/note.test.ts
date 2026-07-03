import { describe, expect, it } from 'vitest';
import { addParticipant, type Participant } from './participant';
import { createPerson } from './person';
import { editNote, noteOf } from './note';

describe('noteOf', () => {
	it('reads an absent Note as empty', () => {
		expect(noteOf(createPerson('Ada Lovelace'))).toBe('');
	});
});

describe('editNote', () => {
	it('sets the Note and preserves line breaks', () => {
		const person = editNote(createPerson('Ada Lovelace'), 'Zeile 1\nZeile 2\n\nZeile 4');

		expect(noteOf(person)).toBe('Zeile 1\nZeile 2\n\nZeile 4');
	});

	it('does not mutate the given record', () => {
		const person = createPerson('Ada Lovelace');

		editNote(person, 'Notiz');

		expect(noteOf(person)).toBe('');
	});

	it('clears the Note with empty text', () => {
		const person = editNote(createPerson('Ada Lovelace'), 'Notiz');

		expect(noteOf(editNote(person, ''))).toBe('');
	});

	it('keeps a Person Note across Events while each Participant Note stays with its Event', () => {
		const person = createPerson('Ada Lovelace');
		const participants: Record<string, Participant> = {};
		const firstParticipant = addParticipant(participants, 'event-1', person.id);
		participants[firstParticipant.id] = firstParticipant;
		const secondParticipant = addParticipant(participants, 'event-2', person.id);

		const notedPerson = editNote(person, 'Vegetarisch');
		const notedFirst = editNote(firstParticipant, 'Reist einen Tag früher an');
		const persons = { [notedPerson.id]: notedPerson };

		expect(noteOf(persons[notedFirst.person])).toBe('Vegetarisch');
		expect(noteOf(persons[secondParticipant.person])).toBe('Vegetarisch');
		expect(noteOf(notedFirst)).toBe('Reist einen Tag früher an');
		expect(noteOf(secondParticipant)).toBe('');
	});
});
