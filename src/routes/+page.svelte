<script lang="ts">
	import { countRecords } from '$lib/domain/library';
	import { libraryState } from '$lib/library.svelte';
</script>

{#if libraryState.status === 'loading'}
	<p>Bibliothek wird geladen …</p>
{:else if libraryState.status === 'error'}
	<p>Bibliothek konnte nicht geladen werden.</p>
{:else}
	<p>Bibliothek geladen, {countRecords(libraryState.library)} Einträge.</p>
{/if}
