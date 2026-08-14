<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ResolvedPathname } from '$app/types';
	import { listParticipants } from '$lib/domain/participant';
	import { frameState } from '$lib/frame.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/icons/icons';
	import { libraryState } from '$lib/library.svelte';

	interface Place {
		href: ResolvedPathname;
		icon: IconName;
		word: string;
		count?: number;
	}

	// The last-opened Veranstaltung keeps its group even on the Übersicht and in Stammdaten,
	// so returning to work is one click. Switching goes through Alle Veranstaltungen.
	const openEvent = $derived(
		frameState.openEventId === null
			? undefined
			: libraryState.library.events[frameState.openEventId]
	);

	function describeEventPlaces(eventId: string, participantCount: number): Place[] {
		return [
			{
				href: resolve('/event/[id]/teilnehmer', { id: eventId }),
				icon: 'users',
				word: 'Teilnehmer',
				count: participantCount
			},
			{
				href: resolve('/event/[id]/einrichtung', { id: eventId }),
				icon: 'sliders-horizontal',
				word: 'Einrichtung'
			},
			{ href: resolve('/event/[id]/import', { id: eventId }), icon: 'file-input', word: 'Import' },
			{ href: resolve('/event/[id]/export', { id: eventId }), icon: 'file-output', word: 'Export' }
		];
	}

	const eventPlaces = $derived.by(() => {
		if (openEvent === undefined) {
			return [];
		}
		const participants = listParticipants(libraryState.library.participants, openEvent.id);
		return describeEventPlaces(openEvent.id, participants.length);
	});

	const overview: Place = {
		href: resolve('/'),
		icon: 'calendar-days',
		word: 'Alle Veranstaltungen'
	};
	const personsHref = resolve('/stammdaten');
	const masterDataSetupHref = resolve('/stammdaten/einrichtung');
</script>

<nav aria-label="Hauptnavigation">
	<p class="label group">Veranstaltung</p>
	{#if openEvent === undefined}
		<p class="none">Noch keine geöffnet.</p>
	{:else}
		<p class="event-name">{openEvent.name}</p>
		{#each eventPlaces as place (place.href)}
			<a href={place.href} aria-current={page.url.pathname === place.href ? 'page' : undefined}>
				<Icon name={place.icon} label={null} />
				<span>{place.word}</span>
				{#if place.count !== undefined}<span class="count">{place.count}</span>{/if}
			</a>
		{/each}
	{/if}

	<hr />

	<a href={overview.href} aria-current={page.url.pathname === overview.href ? 'page' : undefined}>
		<Icon name={overview.icon} label={null} />
		<span>{overview.word}</span>
	</a>
	<p class="stammdaten">
		<Icon name="library" label={null} />
		<span>Stammdaten</span>
	</p>
	<a
		class="sub"
		href={personsHref}
		aria-current={page.url.pathname === personsHref ? 'page' : undefined}
	>
		Personen
	</a>
	<a
		class="sub"
		href={masterDataSetupHref}
		aria-current={page.url.pathname === masterDataSetupHref ? 'page' : undefined}
	>
		Einrichtung
	</a>
</nav>

<style>
	nav {
		position: fixed;
		top: var(--frame-h);
		bottom: 0;
		left: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		width: var(--sidebar-w);
		padding: var(--space-5) 0;
		overflow: auto;
		background: var(--surface);
		border-right: 1px solid var(--rule);
	}

	.group {
		padding: 0 var(--space-5) var(--space-2);
	}

	.none,
	.event-name {
		padding: var(--space-2) var(--space-5) var(--space-3);
		font-size: var(--text-sm);
		line-height: 1.25;
	}

	.none {
		color: var(--ink-mute);
	}

	.event-name {
		font-weight: 600;
	}

	a,
	.stammdaten {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-5);
		border-left: 2px solid transparent;
		font-size: var(--text-sm);
		color: var(--ink);
		text-decoration: none;
	}

	/* A group heading, not a place: muted and unclickable, so it cannot read as a dead link. */
	.stammdaten {
		color: var(--ink-mute);
		font-weight: 600;
	}

	a:hover {
		background: var(--hover);
	}

	a[aria-current='page'] {
		background: var(--selected);
		border-left-color: var(--accent);
		font-weight: 600;
	}

	.sub {
		padding-left: var(--space-7);
	}

	.count {
		margin-left: auto;
		font-family: var(--font-code);
		font-size: var(--text-xs);
		letter-spacing: var(--track-code);
		color: var(--ink-mute);
	}

	hr {
		margin: var(--space-4) 0;
		border: 0;
		border-top: 1px solid var(--rule);
	}
</style>
