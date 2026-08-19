<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ExportViewEditor from '$lib/components/ExportViewEditor.svelte';
	import { libraryState } from '$lib/library.svelte';

	const event = $derived(libraryState.library.events[page.params.id ?? '']);
	// The level is fixed by the place the Ansicht was created in, so this route holds
	// Teilnehmer-level Ansichten of this Veranstaltung and nothing else.
	const view = $derived(libraryState.library.exportViews[page.params.viewId ?? '']);
	const found = $derived(
		event !== undefined
		&& view !== undefined
		&& view.level === 'participant'
		&& view.event === event.id
	);
	const pageTitle = $derived(
		found ? `${view.name} – Export – ${event.name} – AMTS` : 'Ansicht nicht gefunden – AMTS'
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#if !found}
	<p>Export-Ansicht nicht gefunden.</p>
	{#if event === undefined}
		<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>
	{:else}
		<p>
			<a href={resolve('/event/[id]/export', { id: event.id })}>Zurück zu den Export-Ansichten</a>
		</p>
	{/if}
{:else}
	<ExportViewEditor {view} />
{/if}
