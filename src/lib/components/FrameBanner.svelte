<script lang="ts">
	import { frameState, reloadForUpdate } from '$lib/frame.svelte';
	import { libraryState } from '$lib/library.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';

	let confirming = $state(false);

	function requestReload(): void {
		if (frameState.uncommittedWork === null) {
			reloadForUpdate();
			return;
		}
		confirming = true;
	}
</script>

<!-- One slot: a failing store outranks the Import's unreadable file, and both outrank a
     waiting version, which is held until they clear. -->
{#if libraryState.writeFailure !== null}
	<p class="banner failure">
		<span>Speicher nicht verfügbar — Änderungen werden nicht gesichert</span>
		<span class="cause">{libraryState.writeFailure}</span>
	</p>
{:else if frameState.fileError !== null}
	<p class="banner failure">
		<Icon name="triangle-alert" label={null} />
		<span>{frameState.fileError}</span>
	</p>
{:else if frameState.updateWaiting}
	<p class="banner update">
		<span>Neue Version verfügbar</span>
		<button type="button" class="btn quiet" onclick={requestReload}>Neu laden</button>
	</p>
{/if}

{#if confirming}
	<ConfirmDialog
		title="Neu laden?"
		confirmLabel="Neu laden"
		onconfirm={reloadForUpdate}
		onclose={() => (confirming = false)}
	>
		{frameState.uncommittedWork}
	</ConfirmDialog>
{/if}

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

	/* The banner's only action carries the accent, unlike a Quiet button in a register. */
	.update button {
		color: var(--accent);
	}
</style>
