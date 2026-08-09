<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ExportViewManager from '$lib/components/ExportViewManager.svelte';
	import { libraryState } from '$lib/library.svelte';

	const event = $derived(libraryState.library.events[page.url.searchParams.get('id') ?? '']);
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
		<h2>Export — {event.name}</h2>
		<p><a href="{resolve('/event')}?id={event.id}">Zurück zur Veranstaltung</a></p>
		<p>
			Eine Export-Ansicht legt fest, welche Teilnehmer der Filter erfasst und welche Felder in
			welcher Reihenfolge zu Spalten werden. Beim Herunterladen entsteht daraus eine CSV-Datei mit
			einer Zeile je erfasstem Teilnehmer.
		</p>

		<ExportViewManager level="participant" eventId={event.id} />
	</section>
{/if}
