<script lang="ts">
	import { createEvent, listEventsByCreation } from '$lib/domain/event';
	import { libraryState, upsertRecord } from '$lib/library.svelte';

	let eventName = $state('');

	const events = $derived(listEventsByCreation(libraryState.library.events));

	async function addEvent(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (eventName.trim() === '') {
			return;
		}
		await upsertRecord('events', createEvent(eventName));
		eventName = '';
	}
</script>

{#if libraryState.status === 'loading'}
	<p>Bibliothek wird geladen …</p>
{:else if libraryState.status === 'error'}
	<p>Bibliothek konnte nicht geladen werden.</p>
{:else}
	<section>
		<h2>Veranstaltungen</h2>

		<form onsubmit={addEvent}>
			<label>
				Name
				<input type="text" bind:value={eventName} required />
			</label>
			<button type="submit" disabled={eventName.trim() === ''}>Veranstaltung anlegen</button>
		</form>

		{#if events.length === 0}
			<p>Noch keine Veranstaltungen.</p>
		{:else}
			<ul>
				{#each events as event (event.id)}
					<li>{event.name}</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
