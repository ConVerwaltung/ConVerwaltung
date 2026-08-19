<script lang="ts">
	import type { Snippet } from 'svelte';
	import SkipLink from './SkipLink.svelte';
	import { arrowLayer } from './register-arrows';

	interface Props {
		caption: string;
		skipTo: string;
		head: Snippet;
		children: Snippet;
	}

	let { caption, skipTo, head, children }: Props = $props();

	// The rows come from the call site, so the register's conventions are written against
	// the elements it receives: heads carry class="label", a numeric cell class="num", a
	// code cell class="code", the actions cell class="actions". A row action carries
	// class="row-action" to be hover-revealed; a row's single primary action omits it and
	// stays visible.
</script>

<SkipLink target={skipTo}>Register überspringen</SkipLink>

<table use:arrowLayer>
	<caption class="vh">{caption}</caption>
	<thead>{@render head()}</thead>
	<tbody>{@render children()}</tbody>
</table>

<style>
	table {
		width: 100%;
		font-size: var(--text-sm);
	}

	table :global(thead th) {
		position: sticky;
		top: var(--frame-h);
		z-index: 2;
		height: var(--row);
		padding: 0 var(--space-4);
		background: var(--raised);
		border-bottom: 1px solid var(--rule-hard);
		text-align: left;
		white-space: nowrap;
	}

	table :global(td) {
		height: var(--row);
		padding: 0 var(--space-4);
		border-bottom: 1px solid var(--rule);
	}

	/* No zebra: a stripe would be a fifth ground, and every ink token would have to clear
	   4.5:1 against it in both themes. */
	table :global(tbody tr:hover) {
		background: var(--hover);
	}

	table :global(tbody tr.open) {
		background: var(--selected);
	}

	table :global(td.num) {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	table :global(td.code) {
		font-family: var(--font-code);
		letter-spacing: var(--track-code);
	}

	table :global(td.actions) {
		width: 0;
		white-space: nowrap;
		text-align: right;
	}

	/* The detail row that carries editing, so cells stay text rather than becoming ~1,350
	   controls and ~1,350 tab stops. */
	table :global(tr.detail > td) {
		background: var(--inset);
		height: auto;
		padding: var(--space-5) var(--space-4);
	}

	/* opacity, never visibility: hidden, which would take the action out of the tab order. */
	table :global(.row-action) {
		opacity: 0;
	}

	table :global(tr:hover .row-action),
	table :global(tr:focus-within .row-action),
	table :global(tr.open .row-action) {
		opacity: 1;
	}

	@media (pointer: coarse) {
		table :global(.row-action) {
			opacity: 1;
		}
	}
</style>
