<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Blatt from '$lib/components/Blatt.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import CustomFieldManager from '$lib/components/CustomFieldManager.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import InlineEditor from '$lib/components/InlineEditor.svelte';
	import {
		collectEventScopedDeletions,
		listEventsByCreation,
		renameEvent,
		type Event
	} from '$lib/domain/event';
	import type { RecordPut } from '$lib/domain/library';
	import { listParticipants } from '$lib/domain/participant';
	import {
		copyRoles,
		defineRole,
		isRoleNameDefined,
		listRoles,
		removeRoleDefinition,
		renameRole,
		type Role
	} from '$lib/domain/role';
	import { openEditor } from '$lib/editor.svelte';
	import { announce } from '$lib/frame.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import { commitBatch, libraryState, removeRecords, upsertRecord } from '$lib/library.svelte';

	const EVENT_NAME_EDITOR = 'veranstaltung-name';

	let creatingRole = $state(false);
	let draftRoleName = $state('');
	let roleNameError = $state<string | null>(null);
	// The rename is an in-row swap with no submit, so a rejected name states its reason at
	// the row it snapped back into.
	let renameError = $state<{ id: string; message: string } | null>(null);
	let copySourceId = $state('');
	let copyError = $state<string | null>(null);
	let removingRole = $state<Role | null>(null);
	let removingEvent = $state(false);

	let defineRoleButton = $state<HTMLButtonElement | null>(null);
	let roleNameField = $state<HTMLInputElement | null>(null);
	let copySourceField = $state<HTMLSelectElement | null>(null);

	const event = $derived(libraryState.library.events[page.params.id ?? '']);
	const pageTitle = $derived(
		event === undefined
			? 'Veranstaltung nicht gefunden – AMTS'
			: `Einrichtung – ${event.name} – AMTS`
	);

	const roles = $derived(event === undefined ? [] : listRoles(libraryState.library.roles, event.id));
	const participantCount = $derived(
		event === undefined ? 0 : listParticipants(libraryState.library.participants, event.id).length
	);

	// A Rolle is held by Teilnehmer of this Veranstaltung alone, so one pass over the
	// participants answers every row and the removal dialog.
	const holderCounts = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const participant of Object.values(libraryState.library.participants)) {
			for (const roleId of participant.roles) {
				counts[roleId] = (counts[roleId] ?? 0) + 1;
			}
		}
		return counts;
	});

	// Copying from a Veranstaltung without Rollen would be a control that does nothing.
	const copySources = $derived(
		event === undefined
			? []
			: listEventsByCreation(libraryState.library.events).filter(
					(candidate) =>
						candidate.id !== event.id &&
						listRoles(libraryState.library.roles, candidate.id).length > 0
				)
	);

	/* Rollen — defining one, which is the only creation form in this Blatt. */

	async function startDefiningRole(): Promise<void> {
		creatingRole = true;
		await tick();
		roleNameField?.focus();
	}

	function stopDefiningRole(): void {
		creatingRole = false;
		draftRoleName = '';
		roleNameError = null;
		defineRoleButton?.focus();
	}

	// A Rolle is a named reference within a Veranstaltung, so a duplicate name is ambiguous
	// and is refused — unlike a Person or a Veranstaltung, where two of a name is a fact.
	async function commitRoleCreation(submit: SubmitEvent): Promise<void> {
		submit.preventDefault();
		const name = draftRoleName.trim();
		if (name === '') {
			roleNameError = 'Ein Name ist nötig.';
			roleNameField?.focus();
			return;
		}
		if (isRoleNameDefined(libraryState.library.roles, event.id, name)) {
			roleNameError = 'Rollenname bereits vergeben.';
			roleNameField?.focus();
			return;
		}
		await upsertRecord('roles', defineRole(libraryState.library.roles, event.id, name));
		if (libraryState.writeFailure !== null) {
			return;
		}
		stopDefiningRole();
	}

	function roleEditorId(roleId: string): string {
		return `rolle-${roleId}`;
	}

	async function commitRoleRename(role: Role, typed: string): Promise<void> {
		renameError = null;
		const name = typed.trim();
		if (name === '' || name === role.name) {
			return;
		}
		if (isRoleNameDefined(libraryState.library.roles, role.event, name)) {
			renameError = { id: role.id, message: 'Rollenname bereits vergeben.' };
			return;
		}
		await upsertRecord('roles', renameRole(libraryState.library.roles, role, name));
	}

	function describeRoleCascade(role: Role): string {
		const holders = holderCounts[role.id] ?? 0;
		if (holders === 0) {
			return 'Kein Teilnehmer trägt sie.';
		}
		return holders === 1
			? 'Einem Teilnehmer wird sie dabei entzogen.'
			: `${holders} Teilnehmern wird sie dabei entzogen.`;
	}

	// The row that carried the trigger goes with the Rolle, so focus lands on the section's
	// own action instead of on nothing.
	async function removeRole(role: Role): Promise<void> {
		const { deletions, unassignedParticipants } = removeRoleDefinition(
			libraryState.library.participants,
			role.id
		);
		const puts: RecordPut[] = unassignedParticipants.map((participant) => ({
			section: 'participants',
			record: participant
		}));
		await commitBatch({ puts, deletes: deletions });
		if (libraryState.writeFailure !== null) {
			return;
		}
		defineRoleButton?.focus();
	}

	/* The Rollen-Kopie — a cascade, so it is one transaction and it reports its counts. */

	async function copyRolesFromEvent(submit: SubmitEvent): Promise<void> {
		submit.preventDefault();
		if (copySourceId === '') {
			copyError = 'Eine Veranstaltung ist nötig.';
			copySourceField?.focus();
			return;
		}
		const sourceRoles = listRoles(libraryState.library.roles, copySourceId);
		const copied = copyRoles(libraryState.library.roles, copySourceId, event.id);
		const puts: RecordPut[] = copied.map((role) => ({ section: 'roles', record: role }));
		await commitBatch({ puts });
		if (libraryState.writeFailure !== null) {
			return;
		}
		// What was skipped is the part the organizer cannot see: those Rollen were already
		// here, under the names they read in the table above.
		announce(
			`Rollen kopiert: ${copied.length} übernommen, ${sourceRoles.length - copied.length} bereits vorhanden`
		);
		copySourceId = '';
	}

	/* The Veranstaltung itself. */

	function startEventRename(trigger: HTMLElement): void {
		openEditor({ id: EVENT_NAME_EDITOR, trigger });
	}

	async function commitEventRename(target: Event, typed: string): Promise<void> {
		const name = typed.trim();
		if (name === '' || name === target.name) {
			return;
		}
		await upsertRecord('events', renameEvent(target, name));
	}

	// Leaving first: the screen this stands on is one of the things being removed, and the
	// Übersicht is where the removal is visible.
	async function removeEvent(): Promise<void> {
		const { id, name } = event;
		const removedParticipants = participantCount;
		await goto(resolve('/'));
		await removeRecords(collectEventScopedDeletions(libraryState.library, id));
		if (libraryState.writeFailure !== null) {
			return;
		}
		announce(`Veranstaltung entfernt: „${name}“ und ${removedParticipants} Teilnehmer`);
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#snippet defineRoleAction()}
	<button type="button" class="btn primary" onclick={startDefiningRole}>
		<Icon name="plus" label={null} />
		Rolle definieren
	</button>
{/snippet}

{#if event === undefined}
	<p>Veranstaltung nicht gefunden.</p>
	<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>
{:else}
	<div class="page-head">
		<h1>{event.name}</h1>
		<p class="meta">Einrichtung</p>
	</div>

	<div class="stack">
		<Blatt>
			<section>
				<div class="section-head">
					<h2 class="label">Rollen</h2>
					<p class="note">In welcher Eigenschaft ein Teilnehmer hier dabei ist.</p>
					<button
						bind:this={defineRoleButton}
						type="button"
						class="btn primary"
						onclick={startDefiningRole}
					>
						<Icon name="plus" label={null} />
						Rolle definieren
					</button>
				</div>

				<!-- Inline, not a dialog: a dialog is for a decision that blocks work (§7). -->
				{#if creatingRole}
					<form class="create" onsubmit={commitRoleCreation}>
						<div class="field">
							<label class="label" for="neue-rolle">Name</label>
							<input
								bind:this={roleNameField}
								bind:value={draftRoleName}
								id="neue-rolle"
								type="text"
								placeholder="z. B. Spielleitung"
								aria-invalid={roleNameError !== null ? 'true' : undefined}
								aria-describedby={roleNameError !== null ? 'neue-rolle-fehler' : undefined}
								oninput={() => (roleNameError = null)}
							/>
							{#if roleNameError !== null}
								<p id="neue-rolle-fehler" class="field-error">{roleNameError}</p>
							{/if}
						</div>
						<div class="commit">
							<button type="submit" class="btn primary">Definieren</button>
							<button type="button" class="btn quiet" onclick={stopDefiningRole}>Abbrechen</button>
						</div>
					</form>
				{/if}

				{#if roles.length === 0}
					<EmptyState
						tier="nothing-yet"
						message="Noch keine Rollen. Ohne sie ist ein Teilnehmer einfach dabei — mit ihnen steht in der Vermerk-Spalte, als was."
						action={defineRoleAction}
					/>
				{:else}
					<table>
						<thead>
							<tr>
								<th scope="col" class="label">Rolle</th>
								<th scope="col" class="label num">Teilnehmer</th>
								<th scope="col" class="label"><span class="vh">Aktionen</span></th>
							</tr>
						</thead>
						<tbody>
							{#each roles as role (role.id)}
								<tr>
									<td class="name">
										<InlineEditor
											id={roleEditorId(role.id)}
											label="Name der Rolle"
											value={role.name}
											oncommit={(name) => commitRoleRename(role, name)}
										/>
										{#if renameError?.id === role.id}
											<p class="field-error">{renameError.message}</p>
										{/if}
									</td>
									<td class="num">{holderCounts[role.id] ?? 0}</td>
									<td class="actions">
										<button
											type="button"
											class="icon-btn row-action destructive"
											data-tip="Rolle entfernen"
											onclick={() => (removingRole = role)}
										>
											<span class="vh">Rolle „{role.name}“ entfernen</span>
											<Icon name="trash-2" label={null} />
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</section>

			{#if copySources.length > 0}
				<section>
					<h3 class="label">Aus einer anderen Veranstaltung</h3>
					<p class="note">
						Übernommen werden nur die Namen. Rollen, deren Name hier schon vergeben ist, bleiben
						unangetastet.
					</p>
					<form class="copy" onsubmit={copyRolesFromEvent}>
						<div class="field">
							<label class="label" for="rollen-quelle">Veranstaltung</label>
							<select
								bind:this={copySourceField}
								bind:value={copySourceId}
								id="rollen-quelle"
								aria-invalid={copyError !== null ? 'true' : undefined}
								aria-describedby={copyError !== null ? 'rollen-quelle-fehler' : undefined}
								onchange={() => (copyError = null)}
							>
								<!-- A disabled placeholder, because the choice is mandatory (§4). -->
								<option value="" disabled>Veranstaltung wählen …</option>
								{#each copySources as source (source.id)}
									<option value={source.id}>{source.name}</option>
								{/each}
							</select>
							{#if copyError !== null}
								<p id="rollen-quelle-fehler" class="field-error">{copyError}</p>
							{/if}
						</div>
						<button type="submit" class="btn primary">
							<Icon name="copy" label={null} />
							Rollen kopieren
						</button>
					</form>
				</section>
			{/if}
		</Blatt>

		<CustomFieldManager level="participant" eventId={event.id} />

		<Blatt>
			<section>
				<h2 class="label">Veranstaltung</h2>
				<div class="event-name">
					<InlineEditor
						id={EVENT_NAME_EDITOR}
						label="Name der Veranstaltung"
						value={event.name}
						oncommit={(name) => commitEventRename(event, name)}
					>
						{#snippet display()}
							<span class="name">{event.name}</span>
						{/snippet}
					</InlineEditor>
					<button
						type="button"
						class="icon-btn"
						data-tip="Umbenennen"
						onclick={(press) => startEventRename(press.currentTarget)}
					>
						<span class="vh">Veranstaltung „{event.name}“ umbenennen</span>
						<Icon name="pencil" label={null} />
					</button>
				</div>
				<p class="note">
					{participantCount === 1 ? '1 Teilnehmer' : `${participantCount} Teilnehmer`}, {roles.length}
					{roles.length === 1 ? 'Rolle' : 'Rollen'}.
				</p>
			</section>

			<section>
				<h3 class="label">Entfernen</h3>
				<p class="note">
					Mit der Veranstaltung gehen ihre Teilnehmer, Rollen, Teilnehmer-Felder und
					Export-Ansichten. Die Personen bleiben im Personen-Pool.
				</p>
				<!-- The word stays, always: this must not look like a scoped remove before the
				     click, and „Lösch-“ is reserved for die Löschung einer Person. -->
				<button
					type="button"
					class="btn quiet destructive"
					onclick={() => (removingEvent = true)}
				>
					<Icon name="trash-2" label={null} />
					Veranstaltung entfernen …
				</button>
			</section>
		</Blatt>
	</div>
{/if}

{#if removingRole !== null}
	{@const target = removingRole}
	<ConfirmDialog
		title="Rolle entfernen"
		confirmLabel="Entfernen"
		onconfirm={() => removeRole(target)}
		onclose={() => (removingRole = null)}
	>
		Die Rolle „{target.name}“ wird entfernt. {describeRoleCascade(target)}
	</ConfirmDialog>
{/if}

{#if removingEvent && event !== undefined}
	<ConfirmDialog
		title="Veranstaltung entfernen"
		confirmLabel="Entfernen"
		onconfirm={removeEvent}
		onclose={() => (removingEvent = false)}
	>
		Mit „{event.name}“ werden {participantCount} Teilnehmer entfernt, dazu die Rollen,
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

	/* A stack of Blätter, never a Blatt inside a Blatt. */
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.section-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-5);
		margin-bottom: var(--space-5);
	}

	.section-head .btn {
		margin-left: auto;
		flex: none;
		align-self: center;
	}

	h3 {
		margin-bottom: var(--space-2);
	}

	.note {
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.create,
	.copy {
		display: flex;
		align-items: flex-start;
		gap: var(--space-5);
		margin-top: var(--space-5);
		margin-bottom: var(--space-5);
		padding: var(--space-5);
		background: var(--inset);
		border: 1px solid var(--rule);
		border-radius: var(--radius);
	}

	.copy {
		align-items: flex-end;
		margin-bottom: 0;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field input,
	.field select {
		width: 18rem;
		max-width: 100%;
		height: var(--row);
		padding: 0 var(--space-3);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
	}

	.commit {
		display: flex;
		gap: var(--space-4);
		margin-left: auto;
	}

	table {
		width: 100%;
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

	/* The Blatt's own edge closes the list, so the last row carries no rule of its own. */
	tbody tr:last-child > td {
		border-bottom: 0;
	}

	tbody tr:hover {
		background: var(--hover);
	}

	th.num,
	td.num {
		text-align: right;
		font-family: var(--font-code);
		font-variant-numeric: tabular-nums;
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

	.event-name {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}

	.name {
		font-size: var(--text-lg);
		font-weight: 600;
	}

	.event-name :global(input) {
		width: 24rem;
		max-width: 100%;
	}
</style>
