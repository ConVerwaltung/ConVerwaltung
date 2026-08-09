<script lang="ts">
	import { resolve } from '$app/paths';
	import CustomFieldManager from '$lib/components/CustomFieldManager.svelte';
	import CustomValueInput from '$lib/components/CustomValueInput.svelte';
	import ExportViewManager from '$lib/components/ExportViewManager.svelte';
	import {
		customValueOf,
		editCustomValue,
		listPersonFields,
		type CustomFieldDefinition
	} from '$lib/domain/custom-field';
	import { listEventsByCreation } from '$lib/domain/event';
	import { editNote, noteOf } from '$lib/domain/note';
	import { addParticipant, isParticipant } from '$lib/domain/participant';
	import { collectErasureDeletions, listPersonsByName, type Person } from '$lib/domain/person';
	import { libraryState, removeRecords, upsertRecord } from '$lib/library.svelte';

	let selectedPersonId = $state('');
	let selectedEventId = $state('');
	let noteEditPersonId: string | null = $state(null);
	let noteDraft = $state('');
	let erasureCandidateId: string | null = $state(null);
	let erasureNameDraft = $state('');

	const persons = $derived(listPersonsByName(libraryState.library.persons));
	const personFields = $derived(listPersonFields(libraryState.library.customFields));
	const addableEvents = $derived(
		selectedPersonId === ''
			? []
			: listEventsByCreation(libraryState.library.events).filter(
					(event) => !isParticipant(libraryState.library.participants, event.id, selectedPersonId)
				)
	);

	async function addToEvent(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (selectedPersonId === '' || selectedEventId === '') {
			return;
		}
		const participant = addParticipant(
			libraryState.library.participants,
			selectedEventId,
			selectedPersonId
		);
		await upsertRecord('participants', participant);
		selectedEventId = '';
	}

	async function saveValue(person: Person, definition: CustomFieldDefinition, value: string) {
		await upsertRecord('persons', editCustomValue(person, definition, value));
	}

	function startNoteEdit(person: Person) {
		noteEditPersonId = person.id;
		noteDraft = noteOf(person);
	}

	async function submitNote(submitEvent: SubmitEvent, person: Person) {
		submitEvent.preventDefault();
		await upsertRecord('persons', editNote(person, noteDraft));
		noteEditPersonId = null;
	}

	function startErasure(person: Person) {
		erasureCandidateId = person.id;
		erasureNameDraft = '';
	}

	const erasureEventCount = $derived(
		erasureCandidateId === null
			? 0
			: Object.values(libraryState.library.participants).filter(
					(participant) => participant.person === erasureCandidateId
				).length
	);
	const erasureScopeText = $derived(
		erasureEventCount === 0
			? 'derzeit ohne Veranstaltung'
			: erasureEventCount === 1
				? 'in einer Veranstaltung'
				: `in ${erasureEventCount} Veranstaltungen`
	);

	async function submitErasure(submitEvent: SubmitEvent, person: Person) {
		submitEvent.preventDefault();
		if (erasureNameDraft.trim() !== person.name) {
			return;
		}
		await removeRecords(collectErasureDeletions(libraryState.library.participants, person.id));
		erasureCandidateId = null;
		if (selectedPersonId === person.id) {
			selectedPersonId = '';
			selectedEventId = '';
		}
	}
</script>

{#if libraryState.status === 'loading'}
	<p>Bibliothek wird geladen …</p>
{:else if libraryState.status === 'error'}
	<p>Bibliothek konnte nicht geladen werden.</p>
{:else}
	<section>
		<h2>Personen-Pool</h2>
		<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>

		<CustomFieldManager level="person" />

		<ExportViewManager level="person" />

		<h3>Personen</h3>
		{#if persons.length === 0}
			<p>Noch keine Personen.</p>
		{:else}
			<ul>
				{#each persons as person (person.id)}
					<li>
						{person.name}
						{#each personFields as field (field.id)}
							<CustomValueInput
								definition={field}
								value={customValueOf(person, field.id)}
								onsave={(value) => saveValue(person, field, value)}
							/>
						{/each}
						{#if noteEditPersonId === person.id}
							<form onsubmit={(submitEvent) => submitNote(submitEvent, person)}>
								<!-- svelte-ignore a11y_autofocus -->
								<textarea bind:value={noteDraft} rows="4" autofocus></textarea>
								<button type="submit">Speichern</button>
								<button type="button" onclick={() => (noteEditPersonId = null)}>Abbrechen</button>
							</form>
						{:else}
							<button type="button" onclick={() => startNoteEdit(person)}>Notiz bearbeiten</button>
							{#if noteOf(person) !== ''}
								<p class="note">{noteOf(person)}</p>
							{/if}
						{/if}
						{#if erasureCandidateId === person.id}
							<form
								class="erasure"
								onsubmit={(submitEvent) => submitErasure(submitEvent, person)}
							>
								<p>
									<strong>Löschung:</strong> „{person.name}“ wird vollständig und unwiderruflich
									entfernt — die Person selbst sowie alle ihre Teilnehmer-Daten, Notizen und Werte
									benutzerdefinierter Felder ({erasureScopeText}). Anders als beim Entfernen eines
									Teilnehmers bleibt nichts erhalten.
								</p>
								<label>
									Zur Bestätigung den Namen eingeben
									<!-- svelte-ignore a11y_autofocus -->
									<input type="text" bind:value={erasureNameDraft} autofocus />
								</label>
								<button type="submit" disabled={erasureNameDraft.trim() !== person.name}>
									Person unwiderruflich löschen
								</button>
								<button type="button" onclick={() => (erasureCandidateId = null)}>
									Abbrechen
								</button>
							</form>
						{:else}
							<button type="button" onclick={() => startErasure(person)}>Löschung …</button>
						{/if}
					</li>
				{/each}
			</ul>

			<form onsubmit={addToEvent}>
				<label>
					Person
					<select bind:value={selectedPersonId} onchange={() => (selectedEventId = '')}>
						<option value="" disabled>Person wählen …</option>
						{#each persons as person (person.id)}
							<option value={person.id}>{person.name}</option>
						{/each}
					</select>
				</label>
				<label>
					Veranstaltung
					<select bind:value={selectedEventId} disabled={selectedPersonId === ''}>
						<option value="" disabled>Veranstaltung wählen …</option>
						{#each addableEvents as event (event.id)}
							<option value={event.id}>{event.name}</option>
						{/each}
					</select>
				</label>
				<button type="submit" disabled={selectedPersonId === '' || selectedEventId === ''}>
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

	.erasure {
		border: 1px solid #b00020;
		padding: 0.5em;
	}
</style>
