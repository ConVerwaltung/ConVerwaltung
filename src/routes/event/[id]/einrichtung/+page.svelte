<script lang="ts">
	/*
		Interim, and unstyled on purpose: the Rollen and the Teilnehmer-Felder came off the
		Teilnehmer screen, which no longer carries the rare half of the Veranstaltung. The
		screen this becomes — Blätter, in-row rename, a Confirm dialog for every removal — is
		designed in the Einrichtung ticket; nothing here is the design.
	*/
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CustomFieldManager from '$lib/components/CustomFieldManager.svelte';
	import { listEventsByCreation } from '$lib/domain/event';
	import type { RecordPut } from '$lib/domain/library';
	import {
		copyRoles,
		defineRole,
		isRoleNameDefined,
		listRoles,
		removeRoleDefinition,
		renameRole,
		type Role
	} from '$lib/domain/role';
	import { commitBatch, libraryState, upsertRecord } from '$lib/library.svelte';

	let newRoleName = $state('');
	let renamingRoleId: string | null = $state(null);
	let roleRenameDraft = $state('');
	let copySourceEventId = $state('');

	const event = $derived(libraryState.library.events[page.params.id ?? '']);
	const pageTitle = $derived(
		event === undefined
			? 'Veranstaltung nicht gefunden – AMTS'
			: `Einrichtung – ${event.name} – AMTS`
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
	const copySourceEvents = $derived(
		event === undefined
			? []
			: listEventsByCreation(libraryState.library.events).filter(
					(candidate) =>
						candidate.id !== event.id &&
						listRoles(libraryState.library.roles, candidate.id).length > 0
				)
	);

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
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#if event === undefined}
	<p>Veranstaltung nicht gefunden.</p>
	<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>
{:else}
	<h1>Einrichtung</h1>

	<h2>Rollen</h2>
	{#if roles.length === 0}
		<p>Noch keine Rollen definiert.</p>
	{:else}
		<ul>
			{#each roles as role (role.id)}
				<li>
					{#if renamingRoleId === role.id}
						<form onsubmit={(submitEvent) => submitRoleRename(submitEvent, role)}>
							<label>
								<span class="vh">Name der Rolle</span>
								<input type="text" bind:value={roleRenameDraft} required />
							</label>
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
{/if}
