<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ExportViewManager from '$lib/components/ExportViewManager.svelte';
	import { libraryState } from '$lib/library.svelte';

	const event = $derived(libraryState.library.events[page.params.id ?? '']);
	const pageTitle = $derived(
		event === undefined
			? 'Veranstaltung nicht gefunden – AMTS'
			: `Export – ${event.name} – AMTS`
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#if event === undefined}
	<p>Veranstaltung nicht gefunden.</p>
	<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>
{:else}
	<section>
		<h1>Export — {event.name}</h1>
		<p>
			<a href={resolve('/event/[id]/teilnehmer', { id: event.id })}>Zurück zur Veranstaltung</a>
		</p>
		<p>
			Eine Export-Ansicht legt fest, welche Teilnehmer der Filter erfasst und welche Felder in
			welcher Reihenfolge zu Spalten werden. Beim Herunterladen entsteht daraus eine CSV-Datei mit
			einer Zeile je erfasstem Teilnehmer.
		</p>

		<ExportViewManager level="participant" eventId={event.id} />
	</section>
{/if}
