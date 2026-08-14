<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CustomFieldManager from '$lib/components/CustomFieldManager.svelte';
	import CustomValueInput from '$lib/components/CustomValueInput.svelte';
	import {
		customValueOf,
		editCustomValue,
		listParticipantFields,
		listPersonFields,
		type CustomFieldDefinition
	} from '$lib/domain/custom-field';
	import {
		addParticipant,
		collectParticipantScopedDeletions,
		isParticipant,
		listParticipants,
		type Participant
	} from '$lib/domain/participant';
	import { createPerson, listPersonsByName, type Person } from '$lib/domain/person';
	import { listEventsByCreation } from '$lib/domain/event';
	import { editNote, noteOf } from '$lib/domain/note';
	import {
		assignRole,
		copyRoles,
		defineRole,
		isRoleNameDefined,
		listRoles,
		removeRoleDefinition,
		renameRole,
		unassignRole,
		type Role
	} from '$lib/domain/role';
	import type { RecordPut } from '$lib/domain/library';
	import { commitBatch, libraryState, removeRecords, upsertRecord } from '$lib/library.svelte';

	let newPersonName = $state('');
	let selectedPersonId = $state('');
	let newRoleName = $state('');
	let renamingRoleId: string | null = $state(null);
	let roleRenameDraft = $state('');
	let copySourceEventId = $state('');
	let noteEditParticipantId: string | null = $state(null);
	let noteDraft = $state('');

	const event = $derived(libraryState.library.events[page.params.id ?? '']);
	const pageTitle = $derived(
		event === undefined
			? 'Veranstaltung nicht gefunden – AMTS'
			: `Teilnehmer – ${event.name} – AMTS`
	);
	const participants = $derived(
		event === undefined ? [] : listParticipants(libraryState.library.participants, event.id)
	);
	const roles = $derived(event === undefined ? [] : listRoles(libraryState.library.roles, event.id));
	const newRoleNameTaken = $derived(
		event !== undefined && isRoleNameDefined(libraryState.library.roles, event.id, newRoleName)
	);
	const renamingRole = $derived(roles.find((role) => role.id === renamingRoleId));
	const roleRenameTaken = $derived(
		event !== undefined &&
			renamingRole !== undefined &&
			roleRenameDraft.trim() !== renamingRole.name &&
			isRoleNameDefined(libraryState.library.roles, event.id, roleRenameDraft)
	);
	const personFields = $derived(listPersonFields(libraryState.library.customFields));
	const participantFields = $derived(
		event === undefined ? [] : listParticipantFields(libraryState.library.customFields, event.id)
	);
	const copySourceEvents = $derived(
		event === undefined
			? []
			: listEventsByCreation(libraryState.library.events).filter(
					(candidate) =>
						candidate.id !== event.id &&
						listRoles(libraryState.library.roles, candidate.id).length > 0
				)
	);
	const addablePersons = $derived(
		event === undefined
			? []
			: listPersonsByName(libraryState.library.persons).filter(
					(person) => !isParticipant(libraryState.library.participants, event.id, person.id)
				)
	);

	async function addNewPerson(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (newPersonName.trim() === '') {
			return;
		}
		const person = createPerson(newPersonName);
		const participant = addParticipant(libraryState.library.participants, event.id, person.id);
		await upsertRecord('persons', person);
		await upsertRecord('participants', participant);
		newPersonName = '';
	}

	async function addExistingPerson(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (selectedPersonId === '') {
			return;
		}
		const participant = addParticipant(
			libraryState.library.participants,
			event.id,
			selectedPersonId
		);
		await upsertRecord('participants', participant);
		selectedPersonId = '';
	}

	async function addRole(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (newRoleName.trim() === '' || newRoleNameTaken) {
			return;
		}
		await upsertRecord('roles', defineRole(libraryState.library.roles, event.id, newRoleName));
		newRoleName = '';
	}

	async function copyRolesFromEvent(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (copySourceEventId === '') {
			return;
		}
		const copied = copyRoles(libraryState.library.roles, copySourceEventId, event.id);
		const puts: RecordPut[] = copied.map((role) => ({ section: 'roles', record: role }));
		await commitBatch({ puts });
		copySourceEventId = '';
	}

	function startRoleRename(role: Role) {
		renamingRoleId = role.id;
		roleRenameDraft = role.name;
	}

	async function submitRoleRename(submitEvent: SubmitEvent, role: Role) {
		submitEvent.preventDefault();
		if (roleRenameDraft.trim() === '' || roleRenameTaken) {
			return;
		}
		await upsertRecord('roles', renameRole(libraryState.library.roles, role, roleRenameDraft));
		renamingRoleId = null;
	}

	async function removeRole(role: Role) {
		const { deletions, unassignedParticipants } = removeRoleDefinition(
			libraryState.library.participants,
			role.id
		);
		const holderCount = unassignedParticipants.length;
		const cascadeNote =
			holderCount === 0
				? 'Kein Teilnehmer trägt diese Rolle.'
				: holderCount === 1
					? 'Sie wird dabei einem Teilnehmer entzogen.'
					: `Sie wird dabei ${holderCount} Teilnehmern entzogen.`;
		const confirmed = window.confirm(`Rolle „${role.name}“ entfernen?\n${cascadeNote}`);
		if (!confirmed) {
			return;
		}
		const puts: RecordPut[] = unassignedParticipants.map((participant) => ({
			section: 'participants',
			record: participant
		}));
		await commitBatch({ puts, deletes: deletions });
	}

	async function toggleRole(participant: Participant, role: Role) {
		const updated = participant.roles.includes(role.id)
			? unassignRole(participant, role.id)
			: assignRole(participant, role);
		await upsertRecord('participants', updated);
	}

	function startNoteEdit(participant: Participant) {
		noteEditParticipantId = participant.id;
		noteDraft = noteOf(participant);
	}

	async function submitNote(submitEvent: SubmitEvent, participant: Participant) {
		submitEvent.preventDefault();
		await upsertRecord('participants', editNote(participant, noteDraft));
		noteEditParticipantId = null;
	}

	async function savePersonValue(person: Person, definition: CustomFieldDefinition, value: string) {
		await upsertRecord('persons', editCustomValue(person, definition, value));
	}

	async function saveParticipantValue(
		participant: Participant,
		definition: CustomFieldDefinition,
		value: string
	) {
		await upsertRecord('participants', editCustomValue(participant, definition, value));
	}

	async function removeParticipant(participant: Participant) {
		const personName = libraryState.library.persons[participant.person].name;
		const confirmed = window.confirm(
			`Teilnehmer „${personName}“ aus „${event.name}“ entfernen?\n` +
				'Die veranstaltungsbezogenen Daten dieses Teilnehmers gehen verloren; ' +
				'die Person bleibt im Personen-Pool erhalten.'
		);
		if (!confirmed) {
			return;
		}
		await removeRecords(collectParticipantScopedDeletions(participant.id));
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#if event === undefined}
	<p>Veranstaltung nicht gefunden.</p>
	<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>
{:else}
	<section>
		<h1>{event.name}</h1>
		<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>
		<p><a href={resolve('/event/[id]/import', { id: event.id })}>Import</a></p>
		<p><a href={resolve('/event/[id]/export', { id: event.id })}>Export</a></p>

		<h2>Rollen</h2>
		{#if roles.length === 0}
			<p>Noch keine Rollen definiert.</p>
		{:else}
			<ul>
				{#each roles as role (role.id)}
					<li>
						{#if renamingRoleId === role.id}
							<form onsubmit={(submitEvent) => submitRoleRename(submitEvent, role)}>
								<!-- svelte-ignore a11y_autofocus -->
								<input type="text" bind:value={roleRenameDraft} required autofocus />
								<button type="submit" disabled={roleRenameDraft.trim() === '' || roleRenameTaken}>
									Speichern
								</button>
								<button type="button" onclick={() => (renamingRoleId = null)}>Abbrechen</button>
								{#if roleRenameTaken}
									<span>Rollenname bereits vergeben.</span>
								{/if}
							</form>
						{:else}
							{role.name}
							<button type="button" onclick={() => startRoleRename(role)}>Umbenennen</button>
							<button type="button" onclick={() => removeRole(role)}>Entfernen</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<form onsubmit={addRole}>
			<label>
				Neue Rolle
				<input type="text" bind:value={newRoleName} required />
			</label>
			<button type="submit" disabled={newRoleName.trim() === '' || newRoleNameTaken}>
				Rolle definieren
			</button>
			{#if newRoleNameTaken}
				<span>Rollenname bereits vergeben.</span>
			{/if}
		</form>

		{#if copySourceEvents.length > 0}
			<form onsubmit={copyRolesFromEvent}>
				<label>
					Rollen kopieren aus
					<select bind:value={copySourceEventId}>
						<option value="" disabled>Veranstaltung wählen …</option>
						{#each copySourceEvents as sourceEvent (sourceEvent.id)}
							<option value={sourceEvent.id}>{sourceEvent.name}</option>
						{/each}
					</select>
				</label>
				<button type="submit" disabled={copySourceEventId === ''}>Rollen kopieren</button>
				<p>Rollen, deren Name hier bereits vergeben ist, werden übersprungen.</p>
			</form>
		{/if}

		<CustomFieldManager level="participant" eventId={event.id} />

		<h2>Teilnehmer</h2>
		{#if participants.length === 0}
			<p>Noch keine Teilnehmer.</p>
		{:else}
			<ul>
				{#each participants as participant (participant.id)}
					<li>
						{libraryState.library.persons[participant.person].name}
						{#each roles as role (role.id)}
							<label>
								<input
									type="checkbox"
									checked={participant.roles.includes(role.id)}
									onchange={() => toggleRole(participant, role)}
								/>
								{role.name}
							</label>
						{/each}
						<button type="button" onclick={() => removeParticipant(participant)}>
							Entfernen
						</button>
						{#if personFields.length > 0}
							<fieldset>
								<legend>Person (veranstaltungsübergreifend)</legend>
								{#each personFields as field (field.id)}
									<CustomValueInput
										definition={field}
										value={customValueOf(libraryState.library.persons[participant.person], field.id)}
										onsave={(value) =>
											savePersonValue(libraryState.library.persons[participant.person], field, value)}
									/>
								{/each}
							</fieldset>
						{/if}
						{#if participantFields.length > 0}
							<fieldset>
								<legend>Teilnehmer (nur diese Veranstaltung)</legend>
								{#each participantFields as field (field.id)}
									<CustomValueInput
										definition={field}
										value={customValueOf(participant, field.id)}
										onsave={(value) => saveParticipantValue(participant, field, value)}
									/>
								{/each}
							</fieldset>
						{/if}
						{#if noteEditParticipantId === participant.id}
							<form onsubmit={(submitEvent) => submitNote(submitEvent, participant)}>
								<!-- svelte-ignore a11y_autofocus -->
								<textarea bind:value={noteDraft} rows="4" autofocus></textarea>
								<button type="submit">Speichern</button>
								<button type="button" onclick={() => (noteEditParticipantId = null)}>
									Abbrechen
								</button>
							</form>
						{:else}
							<button type="button" onclick={() => startNoteEdit(participant)}>
								Notiz bearbeiten
							</button>
							{#if noteOf(participant) !== ''}
								<p class="note">{noteOf(participant)}</p>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<form onsubmit={addNewPerson}>
			<label>
				Neue Person
				<input type="text" bind:value={newPersonName} required />
			</label>
			<button type="submit" disabled={newPersonName.trim() === ''}>
				Als Teilnehmer hinzufügen
			</button>
		</form>

		{#if addablePersons.length > 0}
			<form onsubmit={addExistingPerson}>
				<label>
					Vorhandene Person
					<select bind:value={selectedPersonId}>
						<option value="" disabled>Person wählen …</option>
						{#each addablePersons as person (person.id)}
							<option value={person.id}>{person.name}</option>
						{/each}
					</select>
				</label>
				<button type="submit" disabled={selectedPersonId === ''}>
					Als Teilnehmer hinzufügen
				</button>
			</form>
		{/if}
	</section>
{/if}

<style>
	.note {
		white-space: pre-line;
		margin: 0;
	}
</style>
