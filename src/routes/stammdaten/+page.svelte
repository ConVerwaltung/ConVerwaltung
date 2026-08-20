<script lang="ts">
	import { resolve } from '$app/paths';
	import CustomFieldManager from '$lib/components/CustomFieldManager.svelte';
	import CustomValueInput from '$lib/components/CustomValueInput.svelte';
	import ExportViewManager from '$lib/components/ExportViewManager.svelte';
	import {
		customValueOf,
		editCustomValue,
		listPersonFields,
		type CustomFieldDefinition
	} from '$lib/domain/custom-field';
	import { editNote, noteOf } from '$lib/domain/note';
	import { listPersonsByName, type Person } from '$lib/domain/person';
	import { libraryState, upsertRecord } from '$lib/library.svelte';

	let noteEditPersonId: string | null = $state(null);
	let noteDraft = $state('');

	const persons = $derived(listPersonsByName(libraryState.library.persons));
	const personFields = $derived(listPersonFields(libraryState.library.customFields));

	async function saveValue(person: Person, definition: CustomFieldDefinition, value: string) {
		await upsertRecord('persons', editCustomValue(person, definition, value));
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

<svelte:head>
	<title>Stammdaten – AMTS</title>
</svelte:head>

<section>
	<h1>Personen-Pool</h1>
	<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>

	<CustomFieldManager level="person" />

	<ExportViewManager level="person" />

	<h2>Personen</h2>
	{#if persons.length === 0}
		<p>Noch keine Personen.</p>
	{:else}
		<ul>
			{#each persons as person (person.id)}
				<li>
					<!-- The name is the way to the Person: Löschung and „Als Teilnehmer hinzufügen“
					     live there now, behind the departure this link is. -->
					<a href={resolve('/person/[id]', { id: person.id })}>{person.name}</a>
					{#each personFields as field (field.id)}
						<CustomValueInput
							definition={field}
							value={customValueOf(person, field.id)}
							onsave={(value) => saveValue(person, field, value)}
						/>
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
	{/if}
</section>
<style>
	.note {
		white-space: pre-line;
		margin: 0;
	}
</style>
