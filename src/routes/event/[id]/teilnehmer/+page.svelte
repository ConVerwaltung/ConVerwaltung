<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Blatt from '$lib/components/Blatt.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import CustomValueInput from '$lib/components/CustomValueInput.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Register from '$lib/components/Register.svelte';
	import {
		customValueOf,
		editCustomValue,
		listParticipantFields,
		listPersonFields,
		type CustomFieldDefinition
	} from '$lib/domain/custom-field';
	import type { RecordPut } from '$lib/domain/library';
	import { editNote, noteOf } from '$lib/domain/note';
	import {
		addParticipant,
		collectParticipantScopedDeletions,
		isParticipant,
		listParticipants,
		type Participant
	} from '$lib/domain/participant';
	import { createPerson, listPersonsByName, type Person } from '$lib/domain/person';
	import { assignRole, listRoles, unassignRole, type Role } from '$lib/domain/role';
	import { closeEditor, isEditorOpen, openEditor, revertible } from '$lib/editor.svelte';
	import { announce } from '$lib/frame.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import { commitBatch, libraryState, removeRecords, upsertRecord } from '$lib/library.svelte';

	interface TeilnehmerRow {
		readonly participant: Participant;
		readonly person: Person;
		// In assignment order, so the first one is the Rolle this Teilnehmer was taken on
		// for — the primary the Vermerk column sets in bold.
		readonly roleNames: readonly string[];
		readonly haystack: string;
	}

	// The column the register rests on. Every Custom-Field column sorts under its own id.
	const BY_PERSON = 'person';

	// A date is stored as an ISO calendar date and read as one — „14.03.2027“.
	const dateFormat = new Intl.DateTimeFormat('de-DE');

	// Enough known Personen to recognise the one meant, few enough that the add-form stays
	// a form rather than a second register. Narrowing is done by typing.
	const CANDIDATE_LIMIT = 8;

	let query = $state('');
	let roleFilterId = $state<string | null>(null);
	let sortKey = $state<string>(BY_PERSON);
	let ascending = $state(true);
	let adding = $state(false);
	let draftName = $state('');
	let chosenPersonId = $state<string | null>(null);
	let nameMissing = $state(false);
	let removing = $state<TeilnehmerRow | null>(null);

	let addButton = $state<HTMLButtonElement | null>(null);
	let nameField = $state<HTMLInputElement | null>(null);
	let queryField = $state<HTMLInputElement | null>(null);

	const event = $derived(libraryState.library.events[page.params.id ?? '']);
	const pageTitle = $derived(
		event === undefined
			? 'Veranstaltung nicht gefunden – AMTS'
			: `Teilnehmer – ${event.name} – AMTS`
	);

	const roles = $derived(event === undefined ? [] : listRoles(libraryState.library.roles, event.id));
	const roleNamesById = $derived(new Map(roles.map((role) => [role.id, role.name])));
	const activeRole = $derived(roles.find((role) => role.id === roleFilterId));

	// Teilnehmer-Felder first, then the Person-Felder that hold in every Veranstaltung.
	const columns = $derived([
		...(event === undefined
			? []
			: listParticipantFields(libraryState.library.customFields, event.id)),
		...listPersonFields(libraryState.library.customFields)
	]);

	const rows = $derived(
		event === undefined
			? []
			: listParticipants(libraryState.library.participants, event.id).map(buildRow)
	);
	const matching = $derived(rows.filter(matchesFilters));
	const shown = $derived(sortRows(matching));
	const tally = $derived(
		matching.length === rows.length
			? countParticipants(rows.length)
			: `${matching.length} von ${rows.length} Teilnehmern`
	);

	const addablePersons = $derived(
		event === undefined
			? []
			: listPersonsByName(libraryState.library.persons).filter(
					(person) => !isParticipant(libraryState.library.participants, event.id, person.id)
				)
	);
	const candidates = $derived(addablePersons.filter(matchesDraftName));
	const chosenPerson = $derived(candidates.find((person) => person.id === chosenPersonId));

	function buildRow(participant: Participant): TeilnehmerRow {
		const person = libraryState.library.persons[participant.person];
		const roleNames = participant.roles
			.map((roleId) => roleNamesById.get(roleId))
			.filter((name) => name !== undefined);
		return { participant, person, roleNames, haystack: searchTextOf(participant, person) };
	}

	// Name, and every Custom-Field value the register shows — which is what „Crew“ and
	// „Charaktername“ are. Rollen stay out of it: they have their own filter.
	function searchTextOf(participant: Participant, person: Person): string {
		const values = [
			...Object.values(participant.customValues ?? {}),
			...Object.values(person.customValues ?? {})
		];
		return [person.name, ...values].join(' ').toLowerCase();
	}

	function countParticipants(count: number): string {
		return count === 1 ? '1 Teilnehmer' : `${count} Teilnehmer`;
	}

	function matchesFilters(row: TeilnehmerRow): boolean {
		const needle = query.trim().toLowerCase();
		const byQuery = needle === '' || row.haystack.includes(needle);
		const byRole = roleFilterId === null || row.participant.roles.includes(roleFilterId);
		return byQuery && byRole;
	}

	function matchesDraftName(person: Person): boolean {
		const needle = draftName.trim().toLowerCase();
		return needle === '' || person.name.toLowerCase().includes(needle);
	}

	function valueOf(row: TeilnehmerRow, field: CustomFieldDefinition): string {
		const record = field.level === 'person' ? row.person : row.participant;
		return customValueOf(record, field.id);
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

	// An empty value sorts behind every filled one, so ascending reads the recorded values
	// first instead of the gaps.
	function compareValues(field: CustomFieldDefinition, left: string, right: string): number {
		if (left === '' || right === '') {
			return left === right ? 0 : left === '' ? 1 : -1;
		}
		if (field.type === 'number') {
			return Number(left) - Number(right);
		}
		return left.localeCompare(right, 'de');
	}

	function compareRows(a: TeilnehmerRow, b: TeilnehmerRow): number {
		if (sortKey === BY_PERSON) {
			return a.person.name.localeCompare(b.person.name, 'de');
		}
		const field = columns.find((column) => column.id === sortKey);
		if (field === undefined) {
			return 0;
		}
		return compareValues(field, valueOf(a, field), valueOf(b, field));
	}

	function sortRows(unsorted: TeilnehmerRow[]): TeilnehmerRow[] {
		const direction = ascending ? 1 : -1;
		return [...unsorted].sort((a, b) => direction * compareRows(a, b));
	}

	// Names read from A, figures from the largest — the first press sorts a column the way
	// it is read.
	function firstDirectionOf(key: string): boolean {
		const field = columns.find((column) => column.id === key);
		return field?.type !== 'number';
	}

	function sortBy(key: string): void {
		ascending = key === sortKey ? !ascending : firstDirectionOf(key);
		sortKey = key;
	}

	function sortStateOf(key: string): 'ascending' | 'descending' | undefined {
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
		if (activeRole !== undefined) {
			parts.push(`Rolle „${activeRole.name}“`);
		}
		return parts.join(' · ');
	}

	function resetFilters(): void {
		query = '';
		roleFilterId = null;
		queryField?.focus();
	}

	function toggleRoleFilter(role: Role): void {
		roleFilterId = roleFilterId === role.id ? null : role.id;
	}

	/* The detail row — one Teilnehmer, opened in place. */

	function detailEditorId(participantId: string): string {
		return `teilnehmer-${participantId}`;
	}

	function isOpen(participantId: string): boolean {
		return isEditorOpen(detailEditorId(participantId));
	}

	// The detail row is an editor like any other, so opening one closes whatever was open
	// and Escape closes this one — neither is a handler this screen owns.
	function toggleDetail(participantId: string, trigger: HTMLElement): void {
		if (isOpen(participantId)) {
			closeEditor(detailEditorId(participantId));
			trigger.focus();
			return;
		}
		openEditor({ id: detailEditorId(participantId), trigger });
	}

	async function toggleRole(participant: Participant, role: Role): Promise<void> {
		const updated = participant.roles.includes(role.id)
			? unassignRole(participant, role.id)
			: assignRole(participant, role);
		await upsertRecord('participants', updated);
	}

	// A Person-Feld holds in every Veranstaltung, a Teilnehmer-Feld only in this one — which
	// record the value lands on is the whole difference between them.
	async function saveValue(
		row: TeilnehmerRow,
		definition: CustomFieldDefinition,
		value: string
	): Promise<void> {
		if (definition.level === 'person') {
			await savePersonValue(row.person, definition, value);
			return;
		}
		await saveParticipantValue(row.participant, definition, value);
	}

	async function saveParticipantValue(
		participant: Participant,
		definition: CustomFieldDefinition,
		value: string
	): Promise<void> {
		await upsertRecord('participants', editCustomValue(participant, definition, value));
	}

	async function savePersonValue(
		person: Person,
		definition: CustomFieldDefinition,
		value: string
	): Promise<void> {
		await upsertRecord('persons', editCustomValue(person, definition, value));
	}

	// Read off the Library rather than off the row: a write replaces the record, and Escape
	// has to put back what is stored now.
	function storedNote(participantId: string): string {
		const participant = libraryState.library.participants[participantId];
		return participant === undefined ? '' : noteOf(participant);
	}

	async function commitNote(participant: Participant, note: string): Promise<void> {
		if (note === noteOf(participant)) {
			return;
		}
		await upsertRecord('participants', editNote(participant, note));
	}

	/* Adding a Teilnehmer — one path, and reuse of a Person is an explicit choice. */

	async function startAdding(): Promise<void> {
		adding = true;
		await tick();
		nameField?.focus();
	}

	function stopAdding(): void {
		adding = false;
		draftName = '';
		chosenPersonId = null;
		nameMissing = false;
		addButton?.focus();
	}

	// Typing invalidates the choice: the selection stands for one known Person, not for a
	// name that happens to read like theirs.
	function typeName(typed: string): void {
		draftName = typed;
		chosenPersonId = null;
		nameMissing = false;
	}

	function choosePerson(person: Person): void {
		chosenPersonId = chosenPersonId === person.id ? null : person.id;
		if (chosenPersonId !== null) {
			draftName = person.name;
		}
		nameMissing = false;
	}

	async function reuseExistingPerson(person: Person): Promise<void> {
		const participant = addParticipant(libraryState.library.participants, event.id, person.id);
		await upsertRecord('participants', participant);
	}

	// The new Person lands in the Personen-Pool, which is off this screen — the one part of
	// this write the organizer cannot see, so it is the one part reported (§3).
	async function createPersonAsParticipant(name: string): Promise<void> {
		const person = createPerson(name);
		const participant = addParticipant(libraryState.library.participants, event.id, person.id);
		const puts: RecordPut[] = [
			{ section: 'persons', record: person },
			{ section: 'participants', record: participant }
		];
		await commitBatch({ puts });
		if (libraryState.writeFailure === null) {
			announce(`Neue Person im Personen-Pool angelegt: „${person.name}“`);
		}
	}

	// Two people sharing a name is the fact ADR-0001 exists to handle, so an unchosen name
	// always creates a Person — a name-equality guess would silently merge two of them.
	async function commitAddition(submit: SubmitEvent): Promise<void> {
		submit.preventDefault();
		if (chosenPerson === undefined && draftName.trim() === '') {
			nameMissing = true;
			nameField?.focus();
			return;
		}
		if (chosenPerson === undefined) {
			await createPersonAsParticipant(draftName);
		} else {
			await reuseExistingPerson(chosenPerson);
		}
		if (libraryState.writeFailure !== null) {
			return;
		}
		stopAdding();
	}

	// The Person is kept: only Erasure removes them, and everything this drops belongs to
	// this Veranstaltung alone.
	async function removeParticipant(row: TeilnehmerRow): Promise<void> {
		await removeRecords(collectParticipantScopedDeletions(row.participant.id));
		if (libraryState.writeFailure !== null) {
			return;
		}
		addButton?.focus();
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#snippet addAction()}
	<button type="button" class="btn primary" onclick={startAdding}>
		<Icon name="plus" label={null} />
		Teilnehmer hinzufügen
	</button>
{/snippet}

{#snippet resetAction()}
	<button type="button" class="btn quiet" onclick={resetFilters}>Filter zurücksetzen</button>
{/snippet}

{#snippet sortableHead(key: string, word: string, field: CustomFieldDefinition | undefined)}
	<th
		scope="col"
		class="label"
		class:num={field?.type === 'number'}
		aria-sort={sortStateOf(key)}
	>
		<button type="button" class="sort" onclick={() => sortBy(key)}>
			{word}
			<!-- Scope is marked by the rare case: only a Person-Feld carries the globe. -->
			{#if field?.level === 'person'}
				<Icon name="globe" label="Person-Feld" />
			{/if}
			{#if sortKey === key}
				<span class="dir" aria-hidden="true">{ascending ? '↑' : '↓'}</span>
			{/if}
		</button>
	</th>
{/snippet}

{#snippet head()}
	<tr>
		<th scope="col" class="label num">Nr.</th>
		{@render sortableHead(BY_PERSON, 'Person', undefined)}
		<th scope="col" class="label">Vermerk</th>
		{#each columns as column (column.id)}
			{@render sortableHead(column.id, column.name, column)}
		{/each}
		<th scope="col" class="label mid">Notiz</th>
		<th scope="col" class="label"><span class="vh">Aktionen</span></th>
	</tr>
{/snippet}

{#if event === undefined}
	<p>Veranstaltung nicht gefunden.</p>
	<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>
{:else}
	<div class="page-head">
		<h1>{event.name}</h1>
		<p class="meta">{tally}</p>
		<button bind:this={addButton} type="button" class="btn primary" onclick={startAdding}>
			<Icon name="plus" label={null} />
			Teilnehmer hinzufügen
		</button>
	</div>

	<!-- Inline and above the register, not a dialog: a dialog costs the organizer their
	     place, and nothing here blocks their work (§7). -->
	{#if adding}
		<form class="add" onsubmit={commitAddition}>
			<div class="field">
				<label class="label" for="neuer-teilnehmer">Person</label>
				<input
					bind:this={nameField}
					id="neuer-teilnehmer"
					type="text"
					value={draftName}
					placeholder="z. B. Maria Schmitt"
					aria-invalid={nameMissing ? 'true' : undefined}
					aria-describedby={nameMissing ? 'neuer-teilnehmer-fehler' : 'neuer-teilnehmer-hinweis'}
					oninput={(typing) => typeName(typing.currentTarget.value)}
				/>
				{#if nameMissing}
					<p id="neuer-teilnehmer-fehler" class="field-error">Ein Name ist nötig.</p>
				{:else}
					<p id="neuer-teilnehmer-hinweis" class="hint">
						Bekannte Person auswählen — oder einen neuen Namen eingeben, dann wird eine Person
						angelegt.
					</p>
				{/if}
			</div>

			{#if addablePersons.length > 0}
				<div class="known">
					<span class="label" id="bekannte-personen">Bekannte Personen</span>
					<div class="chips" role="group" aria-labelledby="bekannte-personen">
						{#each candidates.slice(0, CANDIDATE_LIMIT) as person (person.id)}
							<button
								type="button"
								class="chip"
								aria-pressed={chosenPersonId === person.id}
								onclick={() => choosePerson(person)}
							>
								{person.name}
							</button>
						{/each}
					</div>
					{#if candidates.length > CANDIDATE_LIMIT}
						<p class="hint">
							{candidates.length - CANDIDATE_LIMIT} weitere — den Namen weiter eingeben.
						</p>
					{:else if candidates.length === 0}
						<p class="hint">Keine bekannte Person zu diesem Namen.</p>
					{/if}
				</div>
			{/if}

			<div class="commit">
				<button type="submit" class="btn primary">Hinzufügen</button>
				<button type="button" class="btn quiet" onclick={stopAdding}>Abbrechen</button>
			</div>
		</form>
	{/if}

	{#if rows.length === 0}
		<Blatt>
			<EmptyState
				tier="nothing-yet"
				icon="users"
				message="Noch keine Teilnehmer. Sie kommen einzeln hinzu oder über den Import einer Teilnehmerliste."
				action={addAction}
			/>
		</Blatt>
	{:else}
		<div class="tools">
			<label class="search">
				<span class="vh">Teilnehmer suchen</span>
				<Icon name="search" label={null} />
				<!-- type="text", never type="search": Chrome alone clears that on Escape, which
				     would give the key a fourth meaning by accident. -->
				<input
					bind:this={queryField}
					bind:value={query}
					type="text"
					placeholder="Name, Feldwerte …"
				/>
			</label>
			{#if roles.length > 0}
				<div class="chips" role="group" aria-label="Nach Rolle filtern">
					{#each roles as role (role.id)}
						<button
							type="button"
							class="chip"
							aria-pressed={roleFilterId === role.id}
							onclick={() => toggleRoleFilter(role)}
						>
							{role.name}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<Register caption="Teilnehmer" skipTo="nach-dem-register" {head}>
			{#if shown.length === 0}
				<tr>
					<td colspan={columns.length + 5}>
						<EmptyState
							tier="no-matches"
							message={`Keine Treffer für ${filterDescription()}.`}
							action={resetAction}
						/>
					</td>
				</tr>
			{:else}
				{#each shown as row, place (row.participant.id)}
					{@const open = isOpen(row.participant.id)}
					{@const detailId = `teilnehmer-detail-${row.participant.id}`}
					<tr class:open>
						<td class="num index">{place + 1}</td>
						<td class="name">
							<a href={resolve('/person/[id]', { id: row.person.id })}>{row.person.name}</a>
						</td>
						<!-- The direction's signature: Rollen read as codes, the primary one set
						     bold and underscored, the further ones muted. -->
						<td class="vermerk">
							<span class="codes">
								{#each row.roleNames as roleName, rank (roleName)}
									{#if rank === 0}
										<b>{roleName}</b>
									{:else}
										<span class="further">{roleName}</span>
									{/if}
								{/each}
							</span>
						</td>
						{#each columns as column (column.id)}
							<td class="value" class:num={column.type === 'number'}>
								{displayValue(column, valueOf(row, column))}
							</td>
						{/each}
						<!-- A marker, never an excerpt: two clamped lines would put allergies and
						     health statements permanently on a screen other people can see. -->
						<td class="notiz">
							{#if noteOf(row.participant) !== ''}
								<Icon name="message-square-text" label="Notiz vorhanden" />
							{/if}
						</td>
						<td class="actions">
							<button
								type="button"
								class="icon-btn row-action"
								data-tip={open ? 'Schließen' : 'Bearbeiten'}
								aria-expanded={open}
								aria-controls={detailId}
								onclick={(press) => toggleDetail(row.participant.id, press.currentTarget)}
							>
								<span class="vh">{row.person.name} {open ? 'schließen' : 'bearbeiten'}</span>
								<Icon name={open ? 'chevron-down' : 'pencil'} label={null} />
							</button>
							<button
								type="button"
								class="icon-btn row-action destructive"
								data-tip="Teilnehmer entfernen"
								onclick={() => (removing = row)}
							>
								<span class="vh">Teilnehmer „{row.person.name}“ entfernen</span>
								<Icon name="trash-2" label={null} />
							</button>
						</td>
					</tr>
					{#if open}
						<tr class="detail" id={detailId}>
							<td colspan={columns.length + 5}>
								<div class="detail-grid">
									<div class="stack">
										{#if roles.length > 0}
											<div class="group">
												<span class="label" id="rollen-{row.participant.id}">Rollen</span>
												<div class="chips" role="group" aria-labelledby="rollen-{row.participant.id}">
													{#each roles as role (role.id)}
														<button
															type="button"
															class="chip"
															aria-pressed={row.participant.roles.includes(role.id)}
															onclick={() => toggleRole(row.participant, role)}
														>
															{role.name}
														</button>
													{/each}
												</div>
											</div>
										{/if}

										{#if columns.length > 0}
											<div class="fields">
												{#each columns as column (column.id)}
													<CustomValueInput
														definition={column}
														value={valueOf(row, column)}
														onsave={(value) => saveValue(row, column, value)}
													/>
												{/each}
											</div>
										{/if}

										{#if roles.length === 0 && columns.length === 0}
											<p class="hint">
												Rollen und Teilnehmer-Felder werden in der
												<a href={resolve('/event/[id]/einrichtung', { id: event.id })}>Einrichtung</a>
												angelegt.
											</p>
										{/if}
									</div>

									<div class="stack">
										<div class="field">
											<label class="label" for="notiz-{row.participant.id}">
												Notiz <span class="optional">(optional)</span>
											</label>
											<!-- In a textarea Enter is a newline, so blur is the commit (§5). -->
											<textarea
												id="notiz-{row.participant.id}"
												rows="6"
												value={noteOf(row.participant)}
												onblur={(edit) => commitNote(row.participant, edit.currentTarget.value)}
												use:revertible={() => storedNote(row.participant.id)}
											></textarea>
										</div>
										<!-- Leaving the Veranstaltung is a stated act, not a side effect of
										     reading a name. -->
										<p class="depart">
											<a href={resolve('/person/[id]', { id: row.person.id })}>
												Person öffnen<span class="vh"> — {row.person.name}</span>
											</a>
										</p>
									</div>
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			{/if}
		</Register>

		<p id="nach-dem-register" class="legend" tabindex="-1">
			<span><Icon name="globe" label={null} /> Person-Feld — gilt in allen Veranstaltungen</span>
			<span><Icon name="message-square-text" label={null} /> Notiz vorhanden</span>
		</p>
	{/if}
{/if}

{#if removing !== null}
	{@const target = removing}
	<ConfirmDialog
		title="Teilnehmer entfernen"
		confirmLabel="Entfernen"
		onconfirm={() => removeParticipant(target)}
		onclose={() => (removing = null)}
	>
		Mit „{target.person.name}“ gehen die Rollen, die Teilnehmer-Feldwerte und die Notiz dieser
		Veranstaltung verloren. Die Person bleibt im Personen-Pool, mit allem, was an ihr hängt.
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
		white-space: nowrap;
	}

	.page-head .btn {
		margin-left: auto;
		flex: none;
	}

	.add {
		display: flex;
		align-items: flex-start;
		gap: var(--space-6);
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

	.add .field input {
		width: 20rem;
		max-width: 100%;
		height: var(--row);
		padding: 0 var(--space-4);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
	}

	.known {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 0;
	}

	.commit {
		display: flex;
		gap: var(--space-4);
		margin-left: auto;
	}

	.hint {
		font-size: var(--text-xs);
		color: var(--ink-mute);
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

	/* One shape for every one-word choice on this screen: the Rollen filter, the Rollen of
	   one Teilnehmer, and the known Personen offered to the add-form. */
	.chip {
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

	td.index {
		width: 3rem;
		font-family: var(--font-code);
		font-size: var(--text-xs);
		color: var(--ink-mute);
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

	td.vermerk .codes {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-family: var(--font-code);
		font-size: var(--text-xs);
		letter-spacing: var(--track-code);
	}

	td.vermerk b {
		padding: 0 1px;
		border-bottom: 2px solid var(--rule-hard);
		font-weight: 700;
	}

	td.vermerk .further {
		color: var(--ink-mute);
	}

	td.value {
		color: var(--ink-mute);
	}

	td.num {
		font-family: var(--font-code);
	}

	td.notiz {
		width: 3rem;
		text-align: center;
		color: var(--accent);
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 1fr 22rem;
		gap: var(--space-7);
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		min-width: 0;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: var(--space-5);
	}

	.optional {
		font-weight: 400;
		letter-spacing: normal;
		text-transform: none;
	}

	textarea {
		width: 100%;
		padding: var(--space-3);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
		font-size: var(--text-sm);
		line-height: 1.5;
		resize: vertical;
	}

	.depart {
		font-size: var(--text-sm);
	}

	.legend {
		display: flex;
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
