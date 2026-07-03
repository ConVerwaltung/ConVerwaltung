<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		customValueOf,
		definePersonTextField,
		editCustomValue,
		isPersonFieldNameDefined,
		listPersonFields,
		removeCustomFieldDefinition,
		renameCustomField,
		type CustomFieldDefinition
	} from '$lib/domain/custom-field';
	import { listEventsByCreation } from '$lib/domain/event';
	import { editNote, noteOf } from '$lib/domain/note';
	import { addParticipant, isParticipant } from '$lib/domain/participant';
	import { listPersonsByName, type Person } from '$lib/domain/person';
	import { libraryState, removeRecords, upsertRecord } from '$lib/library.svelte';

	let selectedPersonId = $state('');
	let selectedEventId = $state('');
	let noteEditPersonId: string | null = $state(null);
	let noteDraft = $state('');
	let newFieldName = $state('');
	let renamingFieldId: string | null = $state(null);
	let fieldRenameDraft = $state('');

	const persons = $derived(listPersonsByName(libraryState.library.persons));
	const personFields = $derived(listPersonFields(libraryState.library.customFields));
	const newFieldNameTaken = $derived(
		isPersonFieldNameDefined(libraryState.library.customFields, newFieldName)
	);
	const renamingField = $derived(personFields.find((field) => field.id === renamingFieldId));
	const fieldRenameTaken = $derived(
		renamingField !== undefined &&
			fieldRenameDraft.trim() !== renamingField.name &&
			isPersonFieldNameDefined(libraryState.library.customFields, fieldRenameDraft)
	);
	const addableEvents = $derived(
		selectedPersonId === ''
			? []
			: listEventsByCreation(libraryState.library.events).filter(
					(event) => !isParticipant(libraryState.library.participants, event.id, selectedPersonId)
				)
	);

	async function addToEvent(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (selectedPersonId === '' || selectedEventId === '') {
			return;
		}
		const participant = addParticipant(
			libraryState.library.participants,
			selectedEventId,
			selectedPersonId
		);
		await upsertRecord('participants', participant);
		selectedEventId = '';
	}

	async function addField(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (newFieldName.trim() === '' || newFieldNameTaken) {
			return;
		}
		await upsertRecord(
			'customFields',
			definePersonTextField(libraryState.library.customFields, newFieldName)
		);
		newFieldName = '';
	}

	function startFieldRename(definition: CustomFieldDefinition) {
		renamingFieldId = definition.id;
		fieldRenameDraft = definition.name;
	}

	async function submitFieldRename(submitEvent: SubmitEvent, definition: CustomFieldDefinition) {
		submitEvent.preventDefault();
		if (fieldRenameDraft.trim() === '' || fieldRenameTaken) {
			return;
		}
		await upsertRecord(
			'customFields',
			renameCustomField(libraryState.library.customFields, definition, fieldRenameDraft)
		);
		renamingFieldId = null;
	}

	async function removeField(definition: CustomFieldDefinition) {
		const { deletions, clearedRecords } = removeCustomFieldDefinition(
			libraryState.library.persons,
			definition.id
		);
		const valueCount = clearedRecords.length;
		const cascadeNote =
			valueCount === 0
				? 'Keine Person hat einen Wert in diesem Feld.'
				: valueCount === 1
					? 'Der Wert einer Person geht dabei verloren.'
					: `Die Werte von ${valueCount} Personen gehen dabei verloren.`;
		const confirmed = window.confirm(`Feld „${definition.name}“ entfernen?\n${cascadeNote}`);
		if (!confirmed) {
			return;
		}
		for (const person of clearedRecords) {
			await upsertRecord('persons', person);
		}
		await removeRecords(deletions);
	}

	async function saveValue(person: Person, definition: CustomFieldDefinition, value: string) {
		await upsertRecord('persons', editCustomValue(person, definition.id, value));
	}

	function startNoteEdit(person: Person) {
		noteEditPersonId = person.id;
		noteDraft = noteOf(person);
	}

	async function submitNote(submitEvent: SubmitEvent, person: Person) {
		submitEvent.preventDefault();
		await upsertRecord('persons', editNote(person, noteDraft));
		noteEditPersonId = null;
	}
</script>

{#if libraryState.status === 'loading'}
	<p>Bibliothek wird geladen …</p>
{:else if libraryState.status === 'error'}
	<p>Bibliothek konnte nicht geladen werden.</p>
{:else}
	<section>
		<h2>Personen-Pool</h2>
		<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>

		<h3>Benutzerdefinierte Felder</h3>
		{#if personFields.length === 0}
			<p>Noch keine Felder definiert.</p>
		{:else}
			<ul>
				{#each personFields as field (field.id)}
					<li>
						{#if renamingFieldId === field.id}
							<form onsubmit={(submitEvent) => submitFieldRename(submitEvent, field)}>
								<!-- svelte-ignore a11y_autofocus -->
								<input type="text" bind:value={fieldRenameDraft} required autofocus />
								<button type="submit" disabled={fieldRenameDraft.trim() === '' || fieldRenameTaken}>
									Speichern
								</button>
								<button type="button" onclick={() => (renamingFieldId = null)}>Abbrechen</button>
								{#if fieldRenameTaken}
									<span>Feldname bereits vergeben.</span>
								{/if}
							</form>
						{:else}
							{field.name}
							<button type="button" onclick={() => startFieldRename(field)}>Umbenennen</button>
							<button type="button" onclick={() => removeField(field)}>Entfernen</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<form onsubmit={addField}>
			<label>
				Neues Feld
				<input type="text" bind:value={newFieldName} required />
			</label>
			<button type="submit" disabled={newFieldName.trim() === '' || newFieldNameTaken}>
				Feld definieren
			</button>
			{#if newFieldNameTaken}
				<span>Feldname bereits vergeben.</span>
			{/if}
		</form>

		<h3>Personen</h3>
		{#if persons.length === 0}
			<p>Noch keine Personen.</p>
		{:else}
			<ul>
				{#each persons as person (person.id)}
					<li>
						{person.name}
						{#each personFields as field (field.id)}
							<label>
								{field.name}
								<input
									type="text"
									value={customValueOf(person, field.id)}
									onchange={(inputEvent) =>
										saveValue(person, field, inputEvent.currentTarget.value)}
								/>
							</label>
						{/each}
						{#if noteEditPersonId === person.id}
							<form onsubmit={(submitEvent) => submitNote(submitEvent, person)}>
								<!-- svelte-ignore a11y_autofocus -->
								<textarea bind:value={noteDraft} rows="4" autofocus></textarea>
								<button type="submit">Speichern</button>
								<button type="button" onclick={() => (noteEditPersonId = null)}>Abbrechen</button>
							</form>
						{:else}
							<button type="button" onclick={() => startNoteEdit(person)}>Notiz bearbeiten</button>
							{#if noteOf(person) !== ''}
								<p class="note">{noteOf(person)}</p>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>

			<form onsubmit={addToEvent}>
				<label>
					Person
					<select bind:value={selectedPersonId} onchange={() => (selectedEventId = '')}>
						<option value="" disabled>Person wählen …</option>
						{#each persons as person (person.id)}
							<option value={person.id}>{person.name}</option>
						{/each}
					</select>
				</label>
				<label>
					Veranstaltung
					<select bind:value={selectedEventId} disabled={selectedPersonId === ''}>
						<option value="" disabled>Veranstaltung wählen …</option>
						{#each addableEvents as event (event.id)}
							<option value={event.id}>{event.name}</option>
						{/each}
					</select>
				</label>
				<button type="submit" disabled={selectedPersonId === '' || selectedEventId === ''}>
					Als Teilnehmer hinzufügen
				</button>
			</form>
		{/if}
	</section>
{/if}

<style>
	.note {
		white-space: pre-line;
		margin: 0;
	}
</style>
