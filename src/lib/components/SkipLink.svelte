<script lang="ts">
	import type { Snippet } from 'svelte';

	let { target, children }: { target: string; children: Snippet } = $props();
</script>

<a class="skip" href="#{target}">{@render children()}</a>

<style>
	.skip:not(:focus) {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.skip:focus {
		position: fixed;
		top: var(--space-4);
		left: var(--space-4);
		z-index: 40;
		padding: var(--space-3) var(--space-4);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
		color: var(--ink);
		font-size: var(--text-sm);
		text-decoration: none;
	}
</style>
