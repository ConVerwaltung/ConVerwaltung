<script lang="ts">
	import { resolve } from '$app/paths';
	import Blatt from '$lib/components/Blatt.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Register from '$lib/components/Register.svelte';
	import {
		customValueOf,
		listPersonFields,
		type CustomFieldDefinition
	} from '$lib/domain/custom-field';
	import type { Event } from '$lib/domain/event';
	import { noteOf } from '$lib/domain/note';
	import type { Participant } from '$lib/domain/participant';
	import { listPersonsByName, type Person } from '$lib/domain/person';
	import Icon from '$lib/icons/Icon.svelte';
	import { libraryState } from '$lib/library.svelte';

	interface PoolRow {
		readonly person: Person;
		readonly teilnahmen: number;
		// The most recent Veranstaltung this Person takes part in, or none at all — which
		// ADR-0005 retains as an orphan rather than removing.
		readonly zuletzt: Event | undefined;
	}

	interface Teilnahmen {
		readonly count: number;
		readonly latestEventId: string | undefined;
	}

	type SortKey = 'person' | 'teilnahmen' | 'zuletzt';

	// A column's first press sorts it the way it is read: names from A, the count and the
	// most recent Veranstaltung from the largest.
	const FIRST_DIRECTION: Record<SortKey, boolean> = {
		person: true,
		teilnahmen: false,
		zuletzt: false
	};

	// A date is stored as an ISO calendar date and read as one — „14.03.2027“.
	const dateFormat = new Intl.DateTimeFormat('de-DE');

	let query = $state('');
	let orphansOnly = $state(false);
	let sortKey = $state<SortKey>('person');
	let ascending = $state(true);

	let queryField = $state<HTMLInputElement | null>(null);

	// Every Person-Feld holds for every Person, so the pool's columns are the definitions
	// themselves — there is no per-Person set to reconcile.
	const columns = $derived(listPersonFields(libraryState.library.customFields));

	const teilnahmenByPerson = $derived(countTeilnahmen(libraryState.library.participants));

	const rows = $derived(
		listPersonsByName(libraryState.library.persons).map((person) => buildRow(person))
	);
	const orphans = $derived(rows.filter((row) => row.teilnahmen === 0).length);
	const matching = $derived(rows.filter(matchesFilters));
	const shown = $derived(sortRows(matching));
	const tally = $derived(
		matching.length === rows.length
			? countPersons(rows.length)
			: `${matching.length} von ${countPersons(rows.length)}`
	);

	// One pass over the Teilnehmer answers both figures: how often a Person came, and which
	// Veranstaltung was the last one. UUID v7 ids are timestamp-prefixed, so the most recent
	// Veranstaltung is the largest id — no decoded date is needed to find it.
	function countTeilnahmen(participants: Record<string, Participant>): Record<string, Teilnahmen> {
		const tallies: Record<string, Teilnahmen> = {};
		for (const participant of Object.values(participants)) {
			const held = tallies[participant.person];
			tallies[participant.person] = {
				count: (held?.count ?? 0) + 1,
				latestEventId: laterEventId(held?.latestEventId, participant.event)
			};
		}
		return tallies;
	}

	function laterEventId(held: string | undefined, candidate: string): string {
		return held === undefined || candidate.localeCompare(held) > 0 ? candidate : held;
	}

	function buildRow(person: Person): PoolRow {
		const held = teilnahmenByPerson[person.id];
		const latestEventId = held?.latestEventId;
		return {
			person,
			teilnahmen: held?.count ?? 0,
			zuletzt: latestEventId === undefined ? undefined : libraryState.library.events[latestEventId]
		};
	}

	function countPersons(count: number): string {
		return count === 1 ? '1 Person' : `${count} Personen`;
	}

	// Names only. The pool is read to find one Person among many; a Person-Feld value stands
	// in its own column, and the Notiz is a marker here, never text to be searched.
	function matchesFilters(row: PoolRow): boolean {
		const needle = query.trim().toLowerCase();
		const byQuery = needle === '' || row.person.name.toLowerCase().includes(needle);
		return byQuery && (!orphansOnly || row.teilnahmen === 0);
	}

	function displayValue(field: CustomFieldDefinition, value: string): string {
		if (value === '') {
			return '–';
		}
		if (field.type === 'boolean') {
			return value === 'true' ? 'ja' : 'nein';
		}
		if (field.type === 'date') {
			return dateFormat.format(new Date(`${value}T00:00:00`));
		}
		return value;
	}

	function compareRows(a: PoolRow, b: PoolRow): number {
		if (sortKey === 'teilnahmen') {
			return a.teilnahmen - b.teilnahmen;
		}
		if (sortKey === 'zuletzt') {
			// A Person without Veranstaltung has no key at all, so they sort before every
			// Veranstaltung there is — and last when Zuletzt is read the way it opens,
			// newest first.
			return (a.zuletzt?.id ?? '').localeCompare(b.zuletzt?.id ?? '');
		}
		return a.person.name.localeCompare(b.person.name, 'de');
	}

	function sortRows(unsorted: PoolRow[]): PoolRow[] {
		const direction = ascending ? 1 : -1;
		return [...unsorted].sort((a, b) => direction * compareRows(a, b));
	}

	function sortBy(key: SortKey): void {
		ascending = key === sortKey ? !ascending : FIRST_DIRECTION[key];
		sortKey = key;
	}

	function sortStateOf(key: SortKey): 'ascending' | 'descending' | undefined {
		if (key !== sortKey) {
			return undefined;
		}
		return ascending ? 'ascending' : 'descending';
	}

	function filterDescription(): string {
		const parts: string[] = [];
		if (query.trim() !== '') {
			parts.push(`„${query.trim()}“`);
		}
		if (orphansOnly) {
			parts.push('ohne Teilnahme');
		}
		return parts.join(' · ');
	}

	function resetFilters(): void {
		query = '';
		orphansOnly = false;
		queryField?.focus();
	}
</script>

<svelte:head>
	<title>Personen – Stammdaten – AMTS</title>
</svelte:head>

{#snippet createEventAction()}
	<!-- Not a create-Person form: Personen arrive with an Import into a Veranstaltung, so an
	     empty pool's honest fix is upstream (§9). -->
	<a class="btn primary" href={resolve('/')}>
		<Icon name="plus" label={null} />
		Veranstaltung anlegen
	</a>
{/snippet}

{#snippet resetAction()}
	<button type="button" class="btn quiet" onclick={resetFilters}>Filter zurücksetzen</button>
{/snippet}

{#snippet sortableHead(key: SortKey, word: string, numeric: boolean)}
	<th scope="col" class="label" class:num={numeric} aria-sort={sortStateOf(key)}>
		<button type="button" class="sort" onclick={() => sortBy(key)}>
			{word}
			{#if sortKey === key}
				<span class="dir" aria-hidden="true">{ascending ? '↑' : '↓'}</span>
			{/if}
		</button>
	</th>
{/snippet}

{#snippet head()}
	<tr>
		{@render sortableHead('person', 'Person', false)}
		<!-- The Person-Felder carry no globe of their own: everything here is global, and the
		     legend under the register says so once. -->
		{#each columns as column (column.id)}
			<th scope="col" class="label" class:num={column.type === 'number'}>{column.name}</th>
		{/each}
		{@render sortableHead('teilnahmen', 'Teiln.', true)}
		{@render sortableHead('zuletzt', 'Zuletzt', false)}
		<th scope="col" class="label mid">Notiz</th>
	</tr>
{/snippet}

<div class="page-head">
	<h1>Personen</h1>
	<p class="meta">{tally}</p>
</div>

{#if rows.length === 0}
	<Blatt>
		<EmptyState
			tier="nothing-yet"
			icon="users"
			message="Noch keine Personen. Sie entstehen im Import einer Teilnehmerliste oder beim Hinzufügen eines Teilnehmers — beides beginnt bei einer Veranstaltung."
			action={createEventAction}
		/>
	</Blatt>
{:else}
	<div class="tools">
		<label class="search">
			<span class="vh">Person suchen</span>
			<Icon name="search" label={null} />
			<!-- type="text", never type="search": Chrome alone clears that on Escape, which
			     would give the key a fourth meaning by accident. -->
			<input bind:this={queryField} bind:value={query} type="text" placeholder="Name suchen …" />
		</label>
		{#if orphans > 0}
			<!-- Orphans are a filter, not a hidden class: ADR-0005 keeps them, so the pool
			     states them. -->
			<div class="chips" role="group" aria-label="Personen filtern">
				<button
					type="button"
					class="chip"
					aria-pressed={orphansOnly}
					onclick={() => (orphansOnly = !orphansOnly)}
				>
					Ohne Teilnahme <span class="count">{orphans}</span>
				</button>
			</div>
		{/if}
	</div>

	<Register caption="Personen" skipTo="nach-dem-register" {head}>
		{#if shown.length === 0}
			<tr>
				<td colspan={columns.length + 4}>
					<EmptyState
						tier="no-matches"
						message={`Keine Treffer für ${filterDescription()}.`}
						action={resetAction}
					/>
				</td>
			</tr>
		{:else}
			{#each shown as row (row.person.id)}
				<tr>
					<!-- The name is the only control in a row: 142 Personen cost 142 Tabstopps,
					     not 426. Feldwerte kommen aus dem Import, bearbeitet wird auf der Person. -->
					<td class="name">
						<a href={resolve('/person/[id]', { id: row.person.id })}>{row.person.name}</a>
					</td>
					{#each columns as column (column.id)}
						<td class="value" class:num={column.type === 'number'}>
							{displayValue(column, customValueOf(row.person, column.id))}
						</td>
					{/each}
					<td class="num">{row.teilnahmen}</td>
					<!-- A count plus the most recent Veranstaltung: the full list is on der Person,
					     and naming every Veranstaltung in a row is unbounded. -->
					<td class="zuletzt" class:none={row.zuletzt === undefined}>
						{row.zuletzt?.name ?? 'ohne Veranstaltung'}
					</td>
					<!-- A marker, never an excerpt: two clamped lines would put allergies and
					     health statements permanently on a screen other people can see. -->
					<td class="notiz">
						{#if noteOf(row.person) !== ''}
							<Icon name="message-square-text" label="Notiz vorhanden" />
						{/if}
					</td>
				</tr>
			{/each}
		{/if}
	</Register>

	<p id="nach-dem-register" class="legend" tabindex="-1">
		<span><Icon name="globe" label={null} /> Alles hier gilt in allen Veranstaltungen</span>
		<span><Icon name="message-square-text" label={null} /> Notiz vorhanden</span>
		<span>Bearbeitet wird auf der Person — der Name führt hin.</span>
	</p>
{/if}

<style>
	.page-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-5);
		margin-bottom: var(--space-6);
	}

	h1 {
		font-size: var(--text-xl);
		font-weight: 600;
	}

	.meta {
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	a.btn {
		text-decoration: none;
	}

	.tools {
		display: flex;
		align-items: center;
		gap: var(--space-5);
		margin-bottom: var(--space-4);
	}

	.search {
		position: relative;
		display: flex;
		align-items: center;
		color: var(--ink-mute);
	}

	.search :global(svg) {
		position: absolute;
		left: var(--space-4);
	}

	.search input {
		width: 17rem;
		max-width: 100%;
		height: var(--row);
		padding: 0 var(--space-4) 0 var(--space-7);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
		color: var(--ink);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chip {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
		font-family: var(--font-code);
		font-size: var(--text-xs);
		letter-spacing: var(--track-code);
		color: var(--ink-mute);
		cursor: pointer;
	}

	.chip:hover {
		background: var(--hover);
		color: var(--ink);
	}

	/* aria-pressed carries the state before the ground does — colour is never the only
	   signal (§0.6). */
	.chip[aria-pressed='true'] {
		background: var(--selected);
		border-color: var(--accent);
		color: var(--accent);
		font-weight: 700;
	}

	.chip .count {
		font-variant-numeric: tabular-nums;
	}

	th.num {
		text-align: right;
	}

	th.mid {
		text-align: center;
	}

	/* The head is the button, so the whole cell sorts and the label bundle carries through. */
	.sort {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		text-align: inherit;
		color: inherit;
		cursor: pointer;
	}

	th.num .sort {
		justify-content: flex-end;
	}

	.sort:hover {
		color: var(--ink);
	}

	.dir {
		font-family: var(--font-code);
	}

	td.name {
		font-weight: 600;
	}

	td.name a {
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid var(--rule-hard);
	}

	td.name a:hover {
		color: var(--accent);
		border-bottom-color: currentcolor;
	}

	td.value {
		color: var(--ink-mute);
	}

	td.num {
		font-family: var(--font-code);
	}

	td.zuletzt.none {
		color: var(--ink-mute);
		font-style: italic;
	}

	td.notiz {
		width: 3rem;
		text-align: center;
		color: var(--accent);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-5);
		margin-top: var(--space-4);
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
</style>
