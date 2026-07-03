<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		addParticipant,
		isParticipant,
		listParticipants
	} from '$lib/domain/participant';
	import { createPerson, listPersonsByName } from '$lib/domain/person';
	import { libraryState, upsertRecord } from '$lib/library.svelte';

	let newPersonName = $state('');
	let selectedPersonId = $state('');

	const event = $derived(libraryState.library.events[page.url.searchParams.get('id') ?? '']);
	const participants = $derived(
		event === undefined ? [] : listParticipants(libraryState.library.participants, event.id)
	);
	const addablePersons = $derived(
		event === undefined
			? []
			: listPersonsByName(libraryState.library.persons).filter(
					(person) => !isParticipant(libraryState.library.participants, event.id, person.id)
				)
	);

	async function addNewPerson(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (newPersonName.trim() === '') {
			return;
		}
		const person = createPerson(newPersonName);
		const participant = addParticipant(libraryState.library.participants, event.id, person.id);
		await upsertRecord('persons', person);
		await upsertRecord('participants', participant);
		newPersonName = '';
	}

	async function addExistingPerson(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (selectedPersonId === '') {
			return;
		}
		const participant = addParticipant(
			libraryState.library.participants,
			event.id,
			selectedPersonId
		);
		await upsertRecord('participants', participant);
		selectedPersonId = '';
	}
</script>

{#if libraryState.status === 'loading'}
	<p>Bibliothek wird geladen …</p>
{:else if libraryState.status === 'error'}
	<p>Bibliothek konnte nicht geladen werden.</p>
{:else if event === undefined}
	<p>Veranstaltung nicht gefunden.</p>
	<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>
{:else}
	<section>
		<h2>{event.name}</h2>
		<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>

		<h3>Teilnehmer</h3>
		{#if participants.length === 0}
			<p>Noch keine Teilnehmer.</p>
		{:else}
			<ul>
				{#each participants as participant (participant.id)}
					<li>{libraryState.library.persons[participant.person].name}</li>
				{/each}
			</ul>
		{/if}

		<form onsubmit={addNewPerson}>
			<label>
				Neue Person
				<input type="text" bind:value={newPersonName} required />
			</label>
			<button type="submit" disabled={newPersonName.trim() === ''}>
				Als Teilnehmer hinzufügen
			</button>
		</form>

		{#if addablePersons.length > 0}
			<form onsubmit={addExistingPerson}>
				<label>
					Vorhandene Person
					<select bind:value={selectedPersonId}>
						<option value="" disabled>Person wählen …</option>
						{#each addablePersons as person (person.id)}
							<option value={person.id}>{person.name}</option>
						{/each}
					</select>
				</label>
				<button type="submit" disabled={selectedPersonId === ''}>
					Als Teilnehmer hinzufügen
				</button>
			</form>
		{/if}
	</section>
{/if}
