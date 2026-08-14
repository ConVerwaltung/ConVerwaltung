<script lang="ts">
	import type { Snippet } from 'svelte';
	import { bootLibrary, libraryState } from '$lib/library.svelte';

	let { children }: { children: Snippet } = $props();

	function retry(): void {
		void bootLibrary();
	}
</script>

{#if libraryState.status === 'ready'}
	{@render children()}
{:else if libraryState.status === 'loading'}
	<p class="loading">Bibliothek wird geladen …</p>
{:else}
	<div class="failure">
		{#if libraryState.bootFailure?.blocked}
			<p>Eine andere Registerkarte blockiert die Aktualisierung — bitte schließen.</p>
		{:else}
			<p>Die Bibliothek konnte nicht geöffnet werden. Es sind keine Daten sichtbar.</p>
			<p class="cause">{libraryState.bootFailure?.detail}</p>
		{/if}
		<button type="button" onclick={retry}>Erneut versuchen</button>
	</div>
{/if}

<style>
	.loading {
		color: var(--ink-mute);
	}

	.failure {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-4);
		max-width: 40rem;
		color: var(--danger);
	}

	.cause {
		font-family: var(--font-code);
		font-size: var(--text-xs);
		letter-spacing: var(--track-code);
	}

	button {
		padding: var(--space-3) var(--space-5);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
		color: var(--ink);
		font-size: var(--text-sm);
		cursor: pointer;
	}

	button:hover {
		background: var(--hover);
	}
</style>
