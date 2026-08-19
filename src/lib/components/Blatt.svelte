<script module lang="ts">
	const INSIDE_A_BLATT = Symbol('blatt');
</script>

<script lang="ts">
	import { getContext, setContext, type Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	// There is no card-in-card. The context makes a nested Blatt fail on render instead of
	// something a reviewer has to catch in a screenshot.
	if (getContext(INSIDE_A_BLATT) === true) {
		throw new Error('A Blatt cannot sit inside another Blatt; use a section instead.');
	}
	setContext(INSIDE_A_BLATT, true);
</script>

<div class="blatt">{@render children()}</div>

<style>
	.blatt {
		max-width: var(--sheet-max);
		background: var(--surface);
		border: 1px solid var(--rule-hard);
		border-radius: var(--radius);
	}

	/* Sections inside a Blatt are separated by a hairline, never by another box. */
	.blatt > :global(section) {
		padding: var(--space-6);
	}

	.blatt > :global(section + section) {
		border-top: 1px solid var(--rule);
	}
</style>
