<script lang="ts">
	import { iconPaths, type IconName } from './icons';

	// `label` has no default so a call site cannot leave the naming mechanism undecided:
	// null is decorative inside an already-labelled control, a string annotates content.
	let { name, label }: { name: IconName; label: string | null } = $props();

	const paths = $derived(iconPaths[name]);
</script>

{#if label === null}
	<svg viewBox="0 0 24 24" aria-hidden="true">
		{#each paths as d (d)}
			<path {d} />
		{/each}
	</svg>
{:else}
	<svg viewBox="0 0 24 24" role="img">
		<title>{label}</title>
		{#each paths as d (d)}
			<path {d} />
		{/each}
	</svg>
{/if}

<style>
	svg {
		flex: none;
		width: 1em;
		height: 1em;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: butt;
		stroke-linejoin: miter;
		vertical-align: -0.125em;
	}
</style>
