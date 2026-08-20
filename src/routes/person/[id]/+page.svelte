<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Blatt from '$lib/components/Blatt.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import CustomValueInput from '$lib/components/CustomValueInput.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import InlineEditor from '$lib/components/InlineEditor.svelte';
	import {
		customValueOf,
		editCustomValue,
		listPersonFields,
		type CustomFieldDefinition
	} from '$lib/domain/custom-field';
	import { listEventsByCreation, type Event } from '$lib/domain/event';
	import { editNote, noteOf } from '$lib/domain/note';
	import {
		addParticipant,
		collectParticipantScopedDeletions,
		isParticipant,
		listParticipantsOfPerson,
		type Participant
	} from '$lib/domain/participant';
	import { collectErasureDeletions, renamePerson, type Person } from '$lib/domain/person';
	import { openEditor, revertible } from '$lib/editor.svelte';
	import { announce } from '$lib/frame.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import { libraryState, removeRecords, upsertRecord } from '$lib/library.svelte';

	interface TeilnahmeRow {
		readonly participant: Participant;
		readonly event: Event;
		// In assignment order, so the first one is the Rolle this Teilnehmer was taken on
		// for — the primary the Vermerk codes set in bold.
		readonly roleNames: readonly string[];
	}

	const PERSON_NAME_EDITOR = 'person-name';

	let addEventId = $state('');
	let removingTeilnahme = $state<TeilnahmeRow | null>(null);
	let erasing = $state(false);

	let addField = $state<HTMLSelectElement | null>(null);
	let erasureButton = $state<HTMLButtonElement | null>(null);

	const person = $derived(libraryState.library.persons[page.params.id ?? '']);
	const pageTitle = $derived(
		person === undefined ? 'Person nicht gefunden – AMTS' : `${person.name} – AMTS`
	);

	// Every Person-Feld holds in every Veranstaltung — which is the whole reason this screen
	// exists apart from the Teilnehmer register.
	const personFields = $derived(listPersonFields(libraryState.library.customFields));

	const roleNamesById = $derived(
		new Map(Object.values(libraryState.library.roles).map((role) => [role.id, role.name]))
	);

	const teilnahmen = $derived(
		person === undefined
			? []
			: listParticipantsOfPerson(libraryState.library.participants, person.id).map(buildRow)
	);

	const addableEvents = $derived(
		person === undefined
			? []
			: listEventsByCreation(libraryState.library.events).filter(
					(event) => !isParticipant(libraryState.library.participants, event.id, person.id)
				)
	);

	// Stated in words before anything opens, because the count is what the Löschung means.
	const erasureScope = $derived(
		teilnahmen.length === 0
			? 'derzeit ohne Veranstaltung'
			: teilnahmen.length === 1
				? 'in einer Veranstaltung'
				: `in ${teilnahmen.length} Veranstaltungen`
	);

	function buildRow(participant: Participant): TeilnahmeRow {
		const event = libraryState.library.events[participant.event];
		const roleNames = participant.roles
			.map((roleId) => roleNamesById.get(roleId))
			.filter((name) => name !== undefined);
		return { participant, event, roleNames };
	}

	/* The name — an in-row swap, with no uniqueness check (§4, ADR-0001). */

	function startRename(trigger: HTMLElement): void {
		openEditor({ id: PERSON_NAME_EDITOR, trigger });
	}

	async function commitRename(target: Person, typed: string): Promise<void> {
		const name = typed.trim();
		if (name === '' || name === target.name) {
			return;
		}
		await upsertRecord('persons', renamePerson(target, name));
	}

	/* The global data — the input is the display, so there is no Speichern (§3, §5). */

	async function saveValue(
		target: Person,
		definition: CustomFieldDefinition,
		value: string
	): Promise<void> {
		await upsertRecord('persons', editCustomValue(target, definition, value));
	}

	// Read off the Library rather than off the row: a write replaces the record, and Escape
	// has to put back what is stored now.
	function storedNote(personId: string): string {
		const stored = libraryState.library.persons[personId];
		return stored === undefined ? '' : noteOf(stored);
	}

	async function commitNote(target: Person, note: string): Promise<void> {
		if (note === noteOf(target)) {
			return;
		}
		await upsertRecord('persons', editNote(target, note));
	}

	/* Teilnahmen — adding the Person to a Veranstaltung lives here, and nowhere else. */

	async function addToEvent(eventId: string): Promise<void> {
		const participant = addParticipant(libraryState.library.participants, eventId, person.id);
		await upsertRecord('participants', participant);
		// Nothing is reported: the new row is on this screen (§3). The select goes back to
		// its placeholder either way — a failed write leaves the Library untouched.
		addEventId = '';
	}

	// The Person is kept: only the Löschung removes them, and everything this drops belongs
	// to that one Veranstaltung.
	async function removeTeilnahme(row: TeilnahmeRow): Promise<void> {
		await removeRecords(collectParticipantScopedDeletions(row.participant.id));
		if (libraryState.writeFailure !== null) {
			return;
		}
		(addField ?? erasureButton)?.focus();
	}

	/* Die Löschung — irreversible, across every Veranstaltung, and only from here (ADR-0005). */

	// Leaving first: this screen stands on the record being removed, and the pool is where
	// the Person was.
	async function erasePerson(target: Person): Promise<void> {
		const { id, name } = target;
		const removed = teilnahmen.length;
		await goto(resolve('/stammdaten'));
		await removeRecords(collectErasureDeletions(libraryState.library.participants, id));
		if (libraryState.writeFailure !== null) {
			return;
		}
		announce(`Löschung: ${name}${describeErasedTeilnahmen(removed)}`);
	}

	function describeErasedTeilnahmen(count: number): string {
		if (count === 0) {
			return ' entfernt';
		}
		return count === 1 ? ' und 1 Teilnahme entfernt' : ` und ${count} Teilnahmen entfernt`;
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#if person === undefined}
	<p>Person nicht gefunden.</p>
	<p><a href={resolve('/stammdaten')}>Zum Personen-Pool</a></p>
{:else}
	<div class="column">
		<div class="page-head">
			<h1>
				<InlineEditor
					id={PERSON_NAME_EDITOR}
					label="Name der Person"
					value={person.name}
					oncommit={(name) => commitRename(person, name)}
				>
					{#snippet display()}
						<span class="name">{person.name}</span>
					{/snippet}
				</InlineEditor>
			</h1>
			<button
				type="button"
				class="icon-btn"
				data-tip="Umbenennen"
				onclick={(press) => startRename(press.currentTarget)}
			>
				<span class="vh">Person „{person.name}“ umbenennen</span>
				<Icon name="pencil" label={null} />
			</button>
		</div>
		<!-- Stated once. The departure from der Veranstaltung was already the signal; this
		     confirms it without a wall of warnings. -->
		<p class="scope">
			<Icon name="globe" label={null} />
			Gilt in allen Veranstaltungen
		</p>

		<div class="stack">
			<Blatt>
				<section>
					<h2 class="label">Person-Felder</h2>
					{#if personFields.length === 0}
						<p class="note">
							Noch keine Person-Felder. Sie werden in der
							<a href={resolve('/stammdaten/einrichtung')}>Einrichtung der Stammdaten</a>
							angelegt und gelten dann für jede Person.
						</p>
					{:else}
						<div class="fields">
							{#each personFields as field (field.id)}
								<CustomValueInput
									definition={field}
									value={customValueOf(person, field.id)}
									onsave={(value) => saveValue(person, field, value)}
								/>
							{/each}
						</div>
					{/if}
				</section>

				<section>
					<div class="field">
						<label class="label" for="notiz">
							Notiz <span class="optional">(optional)</span>
						</label>
						<!-- In a textarea Enter is a newline, so blur is the commit (§5). -->
						<textarea
							id="notiz"
							rows="6"
							value={noteOf(person)}
							onblur={(edit) => commitNote(person, edit.currentTarget.value)}
							use:revertible={() => storedNote(person.id)}
						></textarea>
					</div>
				</section>
			</Blatt>

			<Blatt>
				<section>
					<h2 class="label">Teilnahmen</h2>

					{#if teilnahmen.length === 0}
						<EmptyState
							tier="nothing-yet"
							icon="calendar"
							message="Diese Person nimmt an keiner Veranstaltung teil. Sie bleibt trotzdem im Personen-Pool."
						/>
					{:else}
						<table>
							<thead>
								<tr>
									<th scope="col" class="label">Veranstaltung</th>
									<th scope="col" class="label">Vermerk</th>
									<th scope="col" class="label"><span class="vh">Aktionen</span></th>
								</tr>
							</thead>
							<tbody>
								{#each teilnahmen as row (row.participant.id)}
									<tr>
										<td class="name">{row.event.name}</td>
										<!-- The Vermerk codes, reused: the primary Rolle bold and
										     underscored, the further ones muted. -->
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
										<td class="actions">
											<button
												type="button"
												class="icon-btn row-action destructive"
												data-tip="Teilnehmer entfernen"
												onclick={() => (removingTeilnahme = row)}
											>
												<span class="vh">
													Teilnehmer aus „{row.event.name}“ entfernen
												</span>
												<Icon name="trash-2" label={null} />
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}

					{#if addableEvents.length > 0}
						<div class="add">
							<label class="label" for="teilnahme-hinzufuegen">Als Teilnehmer hinzufügen</label>
							<!-- A select persists on change: choosing the Veranstaltung is the whole
							     act, and the new row states the result (§5). -->
							<select
								bind:this={addField}
								bind:value={addEventId}
								id="teilnahme-hinzufuegen"
								onchange={(choice) => addToEvent(choice.currentTarget.value)}
							>
								<option value="" disabled>Veranstaltung wählen …</option>
								{#each addableEvents as event (event.id)}
									<option value={event.id}>{event.name}</option>
								{/each}
							</select>
						</div>
					{:else if teilnahmen.length > 0}
						<p class="note">In jeder Veranstaltung bereits Teilnehmer.</p>
					{:else}
						<p class="note">
							Noch keine Veranstaltung, der die Person hinzugefügt werden könnte —
							<a href={resolve('/')}>eine anlegen</a>.
						</p>
					{/if}
				</section>
			</Blatt>

			<section class="loeschung">
				<h2 class="label">Löschung</h2>
				<p class="note">
					„{person.name}“ ist {erasureScope}. Die Löschung entfernt die Person mit allem, was an
					ihr hängt — in jeder Veranstaltung, unwiderruflich.
				</p>
				<!-- The word stays, always: this must not look like a scoped remove before the
				     click. The only bordered destructive control in the app (§1). -->
				<button
					bind:this={erasureButton}
					type="button"
					class="btn secondary destructive"
					onclick={() => (erasing = true)}
				>
					<Icon name="trash-2" label={null} />
					Löschung …
				</button>
			</section>
		</div>
	</div>
{/if}

{#if removingTeilnahme !== null}
	{@const target = removingTeilnahme}
	<ConfirmDialog
		title="Teilnehmer entfernen"
		confirmLabel="Entfernen"
		onconfirm={() => removeTeilnahme(target)}
		onclose={() => (removingTeilnahme = null)}
	>
		„{person.name}“ nimmt an „{target.event.name}“ nicht mehr teil. Die Rollen, die
		Teilnehmer-Feldwerte und die Notiz dieser Veranstaltung gehen verloren. Die Person bleibt mit
		allem, was an ihr selbst hängt.
	</ConfirmDialog>
{/if}

{#if erasing && person !== undefined}
	{@const target = person}
	<ConfirmDialog
		title="Löschung"
		confirmLabel="Löschung"
		nameToType={target.name}
		onconfirm={() => erasePerson(target)}
		onclose={() => (erasing = false)}
	>
		<!-- Named, not counted: three chips are the cascade, „3 Veranstaltungen“ is a number
		     the organizer would have to go and look up. -->
		{#if teilnahmen.length === 0}
			<p>
				„{target.name}“ wird entfernt, mit der Notiz und allen Person-Feldwerten. Die Person nimmt
				derzeit an keiner Veranstaltung teil.
			</p>
		{:else}
			<p>
				Mit „{target.name}“ gehen die Notiz, alle Person-Feldwerte und jede Teilnahme — in diesen
				Veranstaltungen:
			</p>
			<p class="named">
				{#each teilnahmen as row (row.participant.id)}
					<span class="chip">{row.event.name}</span>
				{/each}
			</p>
		{/if}
		<p>Anders als beim Entfernen eines Teilnehmers bleibt nichts erhalten.</p>
	</ConfirmDialog>
{/if}

<style>
	/* One column: the screen is read top to bottom, and a Blatt at 80rem would strand the
	   Notiz at the width of a page. */
	.column {
		max-width: 52rem;
	}

	.page-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
	}

	h1 {
		font-size: var(--text-xl);
		font-weight: 600;
	}

	h1 :global(input) {
		width: 24rem;
		max-width: 100%;
	}

	.scope {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
		margin-bottom: var(--space-6);
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	/* A stack of Blätter, never a Blatt inside a Blatt. */
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: var(--space-5);
		margin-top: var(--space-5);
	}

	.note {
		margin-top: var(--space-4);
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
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

	table {
		width: 100%;
		margin-top: var(--space-4);
		font-size: var(--text-sm);
	}

	th {
		height: var(--row);
		padding: 0 var(--space-3);
		border-bottom: 1px solid var(--rule-hard);
		text-align: left;
		white-space: nowrap;
	}

	td {
		height: var(--row);
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--rule);
	}

	/* The section below closes the list, so the last row carries no rule of its own. */
	tbody tr:last-child > td {
		border-bottom: 0;
	}

	tbody tr:hover {
		background: var(--hover);
	}

	td.name {
		font-weight: 600;
	}

	td.actions {
		width: 0;
		white-space: nowrap;
		text-align: right;
	}

	/* opacity, never visibility: hidden, which would take the action out of the tab order. */
	.row-action {
		opacity: 0;
	}

	tr:hover .row-action,
	tr:focus-within .row-action {
		opacity: 1;
	}

	@media (pointer: coarse) {
		.row-action {
			opacity: 1;
		}
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

	.add {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		margin-top: var(--space-5);
	}

	.add select {
		width: 18rem;
		max-width: 100%;
		height: var(--row);
		padding: 0 var(--space-3);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
	}

	/* Outside the Blätter: the Löschung is not part of the Person's data, it ends it. */
	.loeschung .btn {
		margin-top: var(--space-4);
	}

	/* Static, not toggles: the dialog names the Veranstaltungen, it does not offer them. */
	.named {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-4) 0;
	}

	.chip {
		padding: var(--space-2) var(--space-4);
		background: var(--raised);
		border: 1px solid var(--rule);
		border-radius: var(--radius);
		font-family: var(--font-code);
		font-size: var(--text-xs);
		letter-spacing: var(--track-code);
	}
</style>
