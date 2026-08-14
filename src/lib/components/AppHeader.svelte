<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SkipLink from './SkipLink.svelte';
	import StatusLine from './StatusLine.svelte';
	import type { Library } from '$lib/domain/library';
	import { libraryState } from '$lib/library.svelte';
	import { setTheme, themeState, type ThemePreference } from '$lib/theme.svelte';

	const themeChoices: readonly { preference: ThemePreference; word: string }[] = [
		{ preference: 'system', word: 'System' },
		{ preference: 'light', word: 'Hell' },
		{ preference: 'dark', word: 'Dunkel' }
	];

	function describePlace(routeId: string | null, recordId: string, library: Library): string[] {
		const eventName = library.events[recordId]?.name ?? 'Veranstaltung';
		switch (routeId) {
			case '/':
				return ['Veranstaltungen'];
			case '/event/[id]/teilnehmer':
				return [eventName, 'Teilnehmer'];
			case '/event/[id]/einrichtung':
				return [eventName, 'Einrichtung'];
			case '/event/[id]/import':
				return [eventName, 'Import'];
			case '/event/[id]/export':
				return [eventName, 'Export'];
			case '/person/[id]':
				return ['Stammdaten', library.persons[recordId]?.name ?? 'Person'];
			case '/stammdaten':
				return ['Stammdaten', 'Personen'];
			case '/stammdaten/einrichtung':
				return ['Stammdaten', 'Einrichtung'];
			default:
				return [];
		}
	}

	const place = $derived(
		describePlace(page.route.id, page.params.id ?? '', libraryState.library)
	);
</script>

<header>
	<SkipLink target="inhalt">Zum Inhalt</SkipLink>
	<!-- The wordmark is not a heading: <h1> is the page title and belongs to each screen. -->
	<a class="wordmark" href={resolve('/')}>AMTS</a>
	<p class="breadcrumb">
		{#each place as part, step (step)}
			{#if step > 0}<span class="separator" aria-hidden="true">›</span>{/if}<span>{part}</span>
		{/each}
	</p>
	<StatusLine />
	<fieldset class="theme">
		<legend class="vh">Thema</legend>
		{#each themeChoices as choice (choice.preference)}
			<label>
				<input
					type="radio"
					name="thema"
					value={choice.preference}
					checked={themeState.preference === choice.preference}
					onchange={() => setTheme(choice.preference)}
				/>
				<span>{choice.word}</span>
			</label>
		{/each}
	</fieldset>
</header>

<style>
	header {
		position: fixed;
		inset: 0 0 auto 0;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: var(--space-5);
		height: var(--frame-h);
		padding: 0 var(--space-6);
		background: var(--surface);
		border-bottom: 1px solid var(--rule-hard);
	}

	.wordmark {
		font-size: var(--text-base);
		font-weight: 700;
		letter-spacing: var(--track-wordmark);
		text-transform: uppercase;
		color: var(--ink);
		text-decoration: none;
	}

	.breadcrumb {
		font-size: var(--text-sm);
		white-space: nowrap;
	}

	.separator {
		padding: 0 var(--space-3);
		color: var(--ink-mute);
	}

	.theme {
		display: flex;
		flex: none;
		padding: 0;
		border: 1px solid var(--control);
		border-radius: var(--radius);
	}

	.theme label {
		position: relative;
		display: block;
		padding: var(--space-2) var(--space-4);
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.theme label:has(:checked) {
		background: var(--selected);
		color: var(--ink);
		font-weight: 600;
	}

	/*
		The radio covers its segment instead of being hidden, so the global focus ring
		outlines the segment and no component has to restate it.
	*/
	.theme input {
		position: absolute;
		inset: 0;
		margin: 0;
		appearance: none;
		border-radius: var(--radius);
		cursor: pointer;
	}

	.theme input:hover {
		background: var(--hover);
	}

	.theme span {
		position: relative;
	}
</style>
