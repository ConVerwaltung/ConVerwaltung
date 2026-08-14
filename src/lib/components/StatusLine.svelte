<script lang="ts">
	import { frameState } from '$lib/frame.svelte';
</script>

<!-- The app's only live region: facts about effects that happen off-screen, never a save. -->
<p class="status" aria-live="polite">{frameState.statusFact}</p>

<style>
	.status {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-align: right;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}
</style>
