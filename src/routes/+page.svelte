<script lang="ts">
	import {
		collectEventScopedDeletions,
		createEvent,
		listEventsByCreation,
		renameEvent,
		type Event
	} from '$lib/domain/event';
	import { resolve } from '$app/paths';
	import { libraryState, removeRecords, upsertRecord } from '$lib/library.svelte';

	let eventName = $state('');
	let renamingEventId: string | null = $state(null);
	let renameDraft = $state('');

	const events = $derived(listEventsByCreation(libraryState.library.events));

	async function addEvent(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (eventName.trim() === '') {
			return;
		}
		await upsertRecord('events', createEvent(eventName));
		eventName = '';
	}

	function startRename(event: Event) {
		renamingEventId = event.id;
		renameDraft = event.name;
	}

	async function submitRename(submitEvent: SubmitEvent, event: Event) {
		submitEvent.preventDefault();
		if (renameDraft.trim() === '') {
			return;
		}
		await upsertRecord('events', renameEvent(event, renameDraft));
		renamingEventId = null;
	}

	async function deleteEvent(event: Event) {
		const confirmed = window.confirm(
			`Veranstaltung „${event.name}“ endgültig löschen?\n` +
				'Alle Teilnehmer dieser Veranstaltung werden entfernt; Personen bleiben erhalten.'
		);
		if (!confirmed) {
			return;
		}
		await removeRecords(collectEventScopedDeletions(libraryState.library, event.id));
	}
</script>

<svelte:head>
	<title>Veranstaltungen – AMTS</title>
</svelte:head>

<section>
	<h1>Veranstaltungen</h1>
	<p><a href={resolve('/stammdaten')}>Personen-Pool</a></p>

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
				<li>
					{#if renamingEventId === event.id}
						<form onsubmit={(submitEvent) => submitRename(submitEvent, event)}>
							<!-- svelte-ignore a11y_autofocus -->
							<input type="text" bind:value={renameDraft} required autofocus />
							<button type="submit" disabled={renameDraft.trim() === ''}>Speichern</button>
							<button type="button" onclick={() => (renamingEventId = null)}>Abbrechen</button>
						</form>
					{:else}
						<a href={resolve('/event/[id]/teilnehmer', { id: event.id })}>{event.name}</a>
						<button type="button" onclick={() => startRename(event)}>Umbenennen</button>
						<button type="button" onclick={() => deleteEvent(event)}>Löschen</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
