<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { libraryState } from '$lib/library.svelte';

	const event = $derived(libraryState.library.events[page.params.id ?? '']);
	const pageTitle = $derived(
		event === undefined ? 'Veranstaltung nicht gefunden – AMTS' : `Einrichtung – ${event.name} – AMTS`
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#if event === undefined}
	<p>Veranstaltung nicht gefunden.</p>
	<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>
{:else}
	<h1>Einrichtung</h1>
	<p>
		Rollen und Teilnehmer-Felder werden zurzeit auf der Seite
		<a href={resolve('/event/[id]/teilnehmer', { id: event.id })}>Teilnehmer</a> verwaltet.
	</p>
{/if}
