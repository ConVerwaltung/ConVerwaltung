<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/icons/icons';

	interface Props {
		tier: 'nothing-yet' | 'no-matches';
		message: string;
		icon?: IconName;
		action?: Snippet;
	}

	let { tier, message, icon, action }: Props = $props();

	// The two tiers mean opposite things, and the difference is carried by where the call
	// site puts this: nothing-yet replaces the whole table including its <thead>, because an
	// empty register has no columns to show; no-matches goes in a <tr><td colspan> and keeps
	// the head, because a register with nothing matching still has its structure.
</script>

<div class="empty" data-tier={tier}>
	{#if icon !== undefined}
		<Icon name={icon} label={null} />
	{/if}
	<p>{message}</p>
	{#if action !== undefined}
		{@render action()}
	{/if}
</div>

<style>
	/* No illustrations — muted prose, at most one glyph, and the action the tier calls for. */
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		color: var(--ink-mute);
		text-align: center;
	}

	.empty[data-tier='nothing-yet'] {
		padding: var(--space-8) var(--space-6);
		font-size: var(--text-base);
	}

	.empty[data-tier='no-matches'] {
		padding: var(--space-6);
		font-size: var(--text-sm);
	}
</style>
