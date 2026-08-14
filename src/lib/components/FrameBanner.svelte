<script lang="ts">
	import { frameState, reloadForUpdate } from '$lib/frame.svelte';
	import { libraryState } from '$lib/library.svelte';

	let confirmReload!: HTMLDialogElement;

	function requestReload(): void {
		if (frameState.uncommittedWork === null) {
			reloadForUpdate();
			return;
		}
		confirmReload.showModal();
	}
</script>

<!-- One slot, two severities: a failing store outranks a waiting version, which is held
     until the failure clears. -->
{#if libraryState.writeFailure !== null}
	<p class="banner failure">
		<span>Speicher nicht verfügbar — Änderungen werden nicht gesichert</span>
		<span class="cause">{libraryState.writeFailure}</span>
	</p>
{:else if frameState.updateWaiting}
	<p class="banner update">
		<span>Neue Version verfügbar</span>
		<button type="button" class="quiet" onclick={requestReload}>Neu laden</button>
	</p>
{/if}

<dialog bind:this={confirmReload}>
	<h2>Neu laden?</h2>
	<p>{frameState.uncommittedWork}</p>
	<form method="dialog" class="choices">
		<button type="submit" class="secondary">Abbrechen</button>
		<button type="submit" class="secondary destructive" onclick={reloadForUpdate}>Neu laden</button>
	</form>
</dialog>

<style>
	.banner {
		display: flex;
		align-items: baseline;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-6);
		border-bottom: 1px solid var(--rule-hard);
		font-size: var(--text-sm);
	}

	.failure {
		background: var(--surface);
		color: var(--danger);
	}

	.cause {
		font-family: var(--font-code);
		font-size: var(--text-xs);
		letter-spacing: var(--track-code);
	}

	.update {
		background: var(--raised);
		color: var(--ink);
	}

	.quiet {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.quiet:hover {
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	dialog {
		max-width: 28rem;
		padding: var(--space-6);
		background: var(--surface);
		border: 1px solid var(--rule-hard);
		border-radius: var(--radius);
		color: var(--ink);
	}

	dialog::backdrop {
		background: var(--scrim);
	}

	dialog h2 {
		font-size: var(--text-base);
		font-weight: 600;
		margin-bottom: var(--space-4);
	}

	.choices {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-4);
		margin-top: var(--space-6);
	}

	.secondary {
		padding: var(--space-3) var(--space-5);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
		color: var(--ink);
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.secondary:hover {
		background: var(--hover);
	}

	.destructive {
		border-color: var(--danger);
		color: var(--danger);
	}
</style>
