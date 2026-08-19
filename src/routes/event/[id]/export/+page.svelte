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
	<div class="page-head">
		<h1>{event.name}</h1>
		<p class="meta">Export</p>
	</div>

	<!-- The register is the screen: an Ansicht is fixed and run often, and the editor is
	     the rare place. -->
	<ExportViewManager level="participant" eventId={event.id} />
{/if}

<style>
	.page-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-5);
		margin-bottom: var(--space-6);
	}

	h1 {
		font-size: var(--text-xl);
		font-weight: 600;
	}

	.meta {
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}
</style>
