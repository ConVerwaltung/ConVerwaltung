<script lang="ts">
	import CustomFieldManager from '$lib/components/CustomFieldManager.svelte';
	import ExportViewManager from '$lib/components/ExportViewManager.svelte';
	import ImportMappingManager from '$lib/components/ImportMappingManager.svelte';
</script>

<svelte:head>
	<title>Einrichtung – Stammdaten – AMTS</title>
</svelte:head>

<!-- Stammdaten splits the way a Veranstaltung splits: the pool is the daily half, this is
     the rare one. The stack of managers is all this screen does. -->
<div class="page-head">
	<h1>Stammdaten</h1>
	<p class="meta">Einrichtung</p>
</div>

<div class="stack">
	<CustomFieldManager level="person" />

	<ImportMappingManager />

	<ExportViewManager level="person" />
</div>

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

	/* A stack of Blätter, never a Blatt inside a Blatt. */
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}
</style>
