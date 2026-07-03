<script lang="ts">
	import { resolve } from '$app/paths';
	import { listEventsByCreation } from '$lib/domain/event';
	import { addParticipant, isParticipant } from '$lib/domain/participant';
	import { listPersonsByName } from '$lib/domain/person';
	import { libraryState, upsertRecord } from '$lib/library.svelte';

	let selectedPersonId = $state('');
	let selectedEventId = $state('');

	const persons = $derived(listPersonsByName(libraryState.library.persons));
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
</script>

{#if libraryState.status === 'loading'}
	<p>Bibliothek wird geladen …</p>
{:else if libraryState.status === 'error'}
	<p>Bibliothek konnte nicht geladen werden.</p>
{:else}
	<section>
		<h2>Personen-Pool</h2>
		<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>

		{#if persons.length === 0}
			<p>Noch keine Personen.</p>
		{:else}
			<ul>
				{#each persons as person (person.id)}
					<li>{person.name}</li>
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
