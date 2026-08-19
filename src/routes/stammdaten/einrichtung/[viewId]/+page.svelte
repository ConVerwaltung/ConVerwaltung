<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ExportViewEditor from '$lib/components/ExportViewEditor.svelte';
	import { libraryState } from '$lib/library.svelte';

	// The same editor, one level up: at Person level the Teilnehmer sources and the Rollen
	// conditions are simply absent.
	const view = $derived(libraryState.library.exportViews[page.params.viewId ?? '']);
	const found = $derived(view !== undefined && view.level === 'person');
	const pageTitle = $derived(
		found ? `${view.name} – Einrichtung – Stammdaten – AMTS` : 'Ansicht nicht gefunden – AMTS'
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#if !found}
	<p>Export-Ansicht nicht gefunden.</p>
	<p><a href={resolve('/stammdaten/einrichtung')}>Zurück zur Einrichtung</a></p>
{:else}
	<ExportViewEditor {view} />
{/if}
