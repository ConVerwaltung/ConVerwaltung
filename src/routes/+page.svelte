<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import Blatt from '$lib/components/Blatt.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import InlineEditor from '$lib/components/InlineEditor.svelte';
	import Register from '$lib/components/Register.svelte';
	import {
		collectEventScopedDeletions,
		createEvent,
		renameEvent,
		type Event
	} from '$lib/domain/event';
	import { creationTimeOf } from '$lib/domain/ids';
	import { compareByCreation, type EventScopedRecord } from '$lib/domain/library';
	import { openEditor } from '$lib/editor.svelte';
	import { announce } from '$lib/frame.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import { libraryState, removeRecords, upsertRecord } from '$lib/library.svelte';

	interface EventRow {
		readonly event: Event;
		readonly participants: number;
		readonly roles: number;
		readonly created: Date | undefined;
	}

	type SortKey = 'name' | 'participants' | 'created';

	// A column's first press sorts it the way it is read: names from A, counts and dates
	// from the largest — which is also the register's resting order, newest first.
	const FIRST_DIRECTION: Record<SortKey, boolean> = {
		name: true,
		participants: false,
		created: false
	};

	// „23. Jan. 2025“ — a fact. No Veranstaltungsdatum exists; see the legend under the table.
	const creationFormat = new Intl.DateTimeFormat('de-DE', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	let query = $state('');
	let sortKey = $state<SortKey>('created');
	let ascending = $state(false);
	let creating = $state(false);
	let draftName = $state('');
	let nameMissing = $state(false);
	let removing = $state<EventRow | null>(null);

	let createButton = $state<HTMLButtonElement | null>(null);
	let nameField = $state<HTMLInputElement | null>(null);
	let queryField = $state<HTMLInputElement | null>(null);

	function countByEvent(records: Record<string, EventScopedRecord>): Record<string, number> {
		const counts: Record<string, number> = {};
		for (const record of Object.values(records)) {
			counts[record.event] = (counts[record.event] ?? 0) + 1;
		}
		return counts;
	}

	const rows = $derived.by(() => {
		const participants = countByEvent(libraryState.library.participants);
		const roles = countByEvent(libraryState.library.roles);
		return Object.values(libraryState.library.events).map((event) => ({
			event,
			participants: participants[event.id] ?? 0,
			roles: roles[event.id] ?? 0,
			created: creationTimeOf(event.id)
		}));
	});

	const matching = $derived(rows.filter((row) => matchesQuery(row.event.name)));
	const shown = $derived(sortRows(matching));
	const tally = $derived(
		matching.length === rows.length
			? countEvents(rows.length)
			: `${matching.length} von ${countEvents(rows.length)}`
	);

	function countEvents(count: number): string {
		return count === 1 ? '1 Veranstaltung' : `${count} Veranstaltungen`;
	}

	function matchesQuery(name: string): boolean {
		const needle = query.trim().toLowerCase();
		return needle === '' || name.toLowerCase().includes(needle);
	}

	function compareRows(a: EventRow, b: EventRow): number {
		if (sortKey === 'name') {
			return a.event.name.localeCompare(b.event.name, 'de');
		}
		if (sortKey === 'participants') {
			return a.participants - b.participants;
		}
		// UUID v7 ids are timestamp-prefixed, so creation order needs no decoded date.
		return compareByCreation(a.event, b.event);
	}

	function sortRows(unsorted: EventRow[]): EventRow[] {
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

	function formatCreation(created: Date | undefined): string {
		return created === undefined ? '–' : creationFormat.format(created);
	}

	async function startCreating(): Promise<void> {
		creating = true;
		await tick();
		nameField?.focus();
	}

	function stopCreating(): void {
		creating = false;
		draftName = '';
		nameMissing = false;
		createButton?.focus();
	}

	// A new record keeps its commit button, and validity never disables it: the reason
	// arrives on submit, at the field it belongs to.
	async function commitCreation(submit: SubmitEvent): Promise<void> {
		submit.preventDefault();
		if (draftName.trim() === '') {
			nameMissing = true;
			nameField?.focus();
			return;
		}
		await upsertRecord('events', createEvent(draftName));
		if (libraryState.writeFailure !== null) {
			return;
		}
		stopCreating();
	}

	function renameEditorId(eventId: string): string {
		return `veranstaltung-${eventId}`;
	}

	// The name cell is a link, so the swap is opened by the row's own action rather than by
	// a trigger the editor renders; focus returns to that action when the edit ends.
	function startRename(row: EventRow, trigger: HTMLElement): void {
		openEditor({ id: renameEditorId(row.event.id), trigger });
	}

	async function commitRename(event: Event, name: string): Promise<void> {
		if (name.trim() === '' || name.trim() === event.name) {
			return;
		}
		await upsertRecord('events', renameEvent(event, name));
	}

	// The Teilnehmer that go with the Veranstaltung are off-screen by definition, so their
	// count is a fact the frame reports; the row that was removed took its own trigger with
	// it, which is why focus lands back on the screen's own action.
	async function removeEvent(row: EventRow): Promise<void> {
		await removeRecords(collectEventScopedDeletions(libraryState.library, row.event.id));
		if (libraryState.writeFailure !== null) {
			return;
		}
		announce(`Veranstaltung entfernt: „${row.event.name}“ und ${row.participants} Teilnehmer`);
		createButton?.focus();
	}

	function clearQuery(): void {
		query = '';
		queryField?.focus();
	}
</script>

<svelte:head>
	<title>Veranstaltungen – AMTS</title>
</svelte:head>

{#snippet createAction()}
	<button type="button" class="btn primary" onclick={startCreating}>
		<Icon name="plus" label={null} />
		Veranstaltung anlegen
	</button>
{/snippet}

{#snippet resetFilter()}
	<button type="button" class="btn quiet" onclick={clearQuery}>Filter zurücksetzen</button>
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
		{@render sortableHead('name', 'Veranstaltung', false)}
		{@render sortableHead('participants', 'Teilnehmer', true)}
		<th scope="col" class="label num">Rollen</th>
		{@render sortableHead('created', 'Angelegt', false)}
		<th scope="col" class="label"><span class="vh">Aktionen</span></th>
	</tr>
{/snippet}

<div class="page-head">
	<h1>Veranstaltungen</h1>
	<p class="meta">{tally}</p>
	<button bind:this={createButton} type="button" class="btn primary" onclick={startCreating}>
		<Icon name="plus" label={null} />
		Veranstaltung anlegen
	</button>
</div>

<!-- The creation form is inline and above the register, not a dialog: a dialog costs the
     organizer their place, and nothing here blocks their work. -->
{#if creating}
	<form class="create" onsubmit={commitCreation}>
		<div class="field">
			<label class="label" for="neue-veranstaltung">Name</label>
			<input
				bind:this={nameField}
				bind:value={draftName}
				id="neue-veranstaltung"
				type="text"
				placeholder="z. B. Sommerlager 2027"
				aria-invalid={nameMissing ? 'true' : undefined}
				aria-describedby={nameMissing ? 'neue-veranstaltung-fehler' : undefined}
				oninput={() => (nameMissing = false)}
			/>
			{#if nameMissing}
				<p id="neue-veranstaltung-fehler" class="field-error">Ein Name ist nötig.</p>
			{/if}
		</div>
		<button type="submit" class="btn primary">Anlegen</button>
		<button type="button" class="btn quiet" onclick={stopCreating}>Abbrechen</button>
	</form>
{/if}

{#if rows.length === 0}
	<Blatt>
		<EmptyState
			tier="nothing-yet"
			icon="calendar-days"
			message="Noch keine Veranstaltungen. Teilnehmer, Rollen und Felder hängen alle an einer Veranstaltung — sie ist der Anfang."
			action={createAction}
		/>
	</Blatt>
{:else}
	<div class="tools">
		<label class="search">
			<span class="vh">Veranstaltung suchen</span>
			<Icon name="search" label={null} />
			<!-- type="text", never type="search": Chrome alone clears that on Escape, which
			     would give the key a fourth meaning by accident. -->
			<input
				bind:this={queryField}
				bind:value={query}
				type="text"
				placeholder="Veranstaltung suchen …"
			/>
		</label>
	</div>

	<Register caption="Veranstaltungen" skipTo="nach-dem-register" {head}>
		{#if shown.length === 0}
			<tr>
				<td colspan="5">
					<EmptyState
						tier="no-matches"
						message={`Keine Treffer für „${query.trim()}“.`}
						action={resetFilter}
					/>
				</td>
			</tr>
		{:else}
			{#each shown as row (row.event.id)}
				<tr>
					<td class="name">
						<InlineEditor
							id={renameEditorId(row.event.id)}
							label="Name der Veranstaltung"
							value={row.event.name}
							oncommit={(name) => commitRename(row.event, name)}
						>
							{#snippet display()}
								<a href={resolve('/event/[id]/teilnehmer', { id: row.event.id })}>
									{row.event.name}
								</a>
							{/snippet}
						</InlineEditor>
					</td>
					<td class="num">{row.participants}</td>
					<td class="num">{row.roles}</td>
					<td class="created">{formatCreation(row.created)}</td>
					<td class="actions">
						<button
							type="button"
							class="icon-btn row-action"
							data-tip="Umbenennen"
							onclick={(press) => startRename(row, press.currentTarget)}
						>
							<span class="vh">„{row.event.name}“ umbenennen</span>
							<Icon name="pencil" label={null} />
						</button>
						<button
							type="button"
							class="icon-btn row-action destructive"
							data-tip="Veranstaltung entfernen …"
							onclick={() => (removing = row)}
						>
							<span class="vh">Veranstaltung „{row.event.name}“ entfernen …</span>
							<Icon name="trash-2" label={null} />
						</button>
					</td>
				</tr>
			{/each}
		{/if}
	</Register>

	<p id="nach-dem-register" class="legend" tabindex="-1">
		Angelegt ist der Zeitstempel der Kennung (UUID v7) — ein Veranstaltungsdatum speichert AMTS
		nicht.
	</p>
{/if}

{#if removing !== null}
	{@const target = removing}
	<ConfirmDialog
		title="Veranstaltung entfernen"
		confirmLabel="Entfernen"
		onconfirm={() => removeEvent(target)}
		onclose={() => (removing = null)}
	>
		Mit „{target.event.name}“ werden {target.participants} Teilnehmer entfernt, dazu die Rollen,
		Teilnehmer-Felder und Export-Ansichten dieser Veranstaltung. Die Personen bleiben im
		Personen-Pool.
	</ConfirmDialog>
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

	.page-head .btn {
		margin-left: auto;
	}

	.create {
		display: flex;
		align-items: flex-end;
		gap: var(--space-5);
		margin-bottom: var(--space-5);
		padding: var(--space-5);
		background: var(--inset);
		border: 1px solid var(--rule);
		border-radius: var(--radius);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field input,
	.search input {
		height: var(--row);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
	}

	.field input {
		width: 20rem;
		max-width: 100%;
		padding: 0 var(--space-4);
	}

	.tools {
		display: flex;
		align-items: center;
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
		padding: 0 var(--space-4) 0 var(--space-7);
		color: var(--ink);
	}

	th.num {
		text-align: right;
	}

	/* The head is the button, so the whole cell sorts and the label bundle carries through. */
	.sort {
		display: block;
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

	.sort:hover {
		color: var(--ink);
	}

	.dir {
		font-family: var(--font-code);
	}

	td.created {
		width: 8rem;
		font-family: var(--font-code);
		font-size: var(--text-xs);
		color: var(--ink-mute);
		white-space: nowrap;
	}

	.legend {
		margin-top: var(--space-4);
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}
</style>
