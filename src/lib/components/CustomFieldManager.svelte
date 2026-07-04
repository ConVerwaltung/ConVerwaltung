<script lang="ts">
	import {
		changeCustomFieldType,
		countCustomValues,
		customFieldTypes,
		defineParticipantField,
		definePersonField,
		editSelectOptions,
		isParticipantFieldNameDefined,
		isPersonFieldNameDefined,
		listParticipantFields,
		listPersonFields,
		listUsedCustomValues,
		parseSelectOptions,
		removeCustomFieldDefinition,
		renameCustomField,
		type CustomFieldDefinition,
		type CustomFieldLevel,
		type CustomFieldType,
		type CustomValuedRecord
	} from '$lib/domain/custom-field';
	import { libraryState, removeRecords, upsertRecord } from '$lib/library.svelte';

	interface Props {
		level: CustomFieldLevel;
		/** Required at Participant level. */
		eventId?: string;
	}

	let { level, eventId = '' }: Props = $props();

	const typeLabels: Record<CustomFieldType, string> = {
		text: 'Text',
		number: 'Zahl',
		boolean: 'Ja/Nein',
		date: 'Datum',
		select: 'Auswahl'
	};

	let newName = $state('');
	let newType = $state<CustomFieldType>('text');
	let newOptionsText = $state('');
	let editingFieldId: string | null = $state(null);
	let editName = $state('');
	let editType = $state<CustomFieldType>('text');
	let editOptionsText = $state('');

	const fields = $derived(
		level === 'person'
			? listPersonFields(libraryState.library.customFields)
			: listParticipantFields(libraryState.library.customFields, eventId)
	);
	const valuedRecords: Record<string, CustomValuedRecord> = $derived(
		level === 'person' ? libraryState.library.persons : libraryState.library.participants
	);

	function isNameTaken(name: string): boolean {
		return level === 'person'
			? isPersonFieldNameDefined(libraryState.library.customFields, name)
			: isParticipantFieldNameDefined(libraryState.library.customFields, eventId, name);
	}

	const newNameTaken = $derived(isNameTaken(newName));
	const newOptions = $derived(parseSelectOptions(newOptionsText));
	const newFieldInvalid = $derived(
		newName.trim() === '' || newNameTaken || (newType === 'select' && newOptions.length === 0)
	);

	const editingField = $derived(fields.find((field) => field.id === editingFieldId));
	const editNameTaken = $derived(
		editingField !== undefined && editName.trim() !== editingField.name && isNameTaken(editName)
	);
	const editingFieldHasValues = $derived(
		editingField !== undefined && countCustomValues(valuedRecords, editingField.id) > 0
	);
	const editOptions = $derived(parseSelectOptions(editOptionsText));
	const editStillUsedOptions = $derived(
		editingField === undefined || editType !== 'select'
			? []
			: listUsedCustomValues(valuedRecords, editingField.id).filter(
					(value) => !editOptions.includes(value)
				)
	);
	const editInvalid = $derived(
		editingField === undefined ||
			editName.trim() === '' ||
			editNameTaken ||
			(editType !== editingField.type && editingFieldHasValues) ||
			(editType === 'select' && editOptions.length === 0) ||
			editStillUsedOptions.length > 0
	);

	async function addField(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (newFieldInvalid) {
			return;
		}
		const definition =
			level === 'person'
				? definePersonField(libraryState.library.customFields, newName, newType, newOptions)
				: defineParticipantField(
						libraryState.library.customFields,
						eventId,
						newName,
						newType,
						newOptions
					);
		await upsertRecord('customFields', definition);
		newName = '';
		newType = 'text';
		newOptionsText = '';
	}

	function startEdit(definition: CustomFieldDefinition) {
		editingFieldId = definition.id;
		editName = definition.name;
		editType = definition.type;
		editOptionsText = (definition.selectOptions ?? []).join('\n');
	}

	async function submitEdit(submitEvent: SubmitEvent, definition: CustomFieldDefinition) {
		submitEvent.preventDefault();
		if (editInvalid) {
			return;
		}
		let updated = definition;
		if (editName.trim() !== definition.name) {
			updated = renameCustomField(libraryState.library.customFields, updated, editName);
		}
		if (editType !== definition.type) {
			updated = changeCustomFieldType(valuedRecords, updated, editType, editOptions);
		} else if (editType === 'select') {
			updated = editSelectOptions(valuedRecords, updated, editOptions);
		}
		await upsertRecord('customFields', updated);
		editingFieldId = null;
	}

	function removalCascadeNote(valueCount: number): string {
		if (level === 'person') {
			return valueCount === 0
				? 'Keine Person hat einen Wert in diesem Feld.'
				: valueCount === 1
					? 'Der Wert einer Person geht dabei verloren.'
					: `Die Werte von ${valueCount} Personen gehen dabei verloren.`;
		}
		return valueCount === 0
			? 'Kein Teilnehmer hat einen Wert in diesem Feld.'
			: valueCount === 1
				? 'Der Wert eines Teilnehmers geht dabei verloren.'
				: `Die Werte von ${valueCount} Teilnehmern gehen dabei verloren.`;
	}

	async function removeField(definition: CustomFieldDefinition) {
		const valueCount = countCustomValues(valuedRecords, definition.id);
		const confirmed = window.confirm(
			`Feld „${definition.name}“ entfernen?\n${removalCascadeNote(valueCount)}`
		);
		if (!confirmed) {
			return;
		}
		if (level === 'person') {
			const { deletions, clearedRecords } = removeCustomFieldDefinition(
				libraryState.library.persons,
				definition.id
			);
			for (const person of clearedRecords) {
				await upsertRecord('persons', person);
			}
			await removeRecords(deletions);
		} else {
			const { deletions, clearedRecords } = removeCustomFieldDefinition(
				libraryState.library.participants,
				definition.id
			);
			for (const participant of clearedRecords) {
				await upsertRecord('participants', participant);
			}
			await removeRecords(deletions);
		}
	}
</script>

<h3>Benutzerdefinierte Felder</h3>
{#if level === 'participant'}
	<p>Diese Felder gelten nur für Teilnehmer dieser Veranstaltung.</p>
{/if}
{#if fields.length === 0}
	<p>Noch keine Felder definiert.</p>
{:else}
	<ul>
		{#each fields as field (field.id)}
			<li>
				{#if editingFieldId === field.id}
					<form onsubmit={(submitEvent) => submitEdit(submitEvent, field)}>
						<!-- svelte-ignore a11y_autofocus -->
						<input type="text" bind:value={editName} required autofocus />
						<label>
							Typ
							<select bind:value={editType} disabled={editingFieldHasValues}>
								{#each customFieldTypes as fieldType (fieldType)}
									<option value={fieldType}>{typeLabels[fieldType]}</option>
								{/each}
							</select>
						</label>
						{#if editingFieldHasValues}
							<span>Typ ist nicht änderbar, solange Werte eingetragen sind.</span>
						{/if}
						{#if editType === 'select'}
							<label>
								Optionen (eine pro Zeile)
								<textarea bind:value={editOptionsText} rows="4"></textarea>
							</label>
							{#if editStillUsedOptions.length > 0}
								<span>
									Noch verwendete Optionen können nicht entfernt werden:
									{editStillUsedOptions.join(', ')}
								</span>
							{/if}
						{/if}
						<button type="submit" disabled={editInvalid}>Speichern</button>
						<button type="button" onclick={() => (editingFieldId = null)}>Abbrechen</button>
						{#if editNameTaken}
							<span>Feldname bereits vergeben.</span>
						{/if}
					</form>
				{:else}
					{field.name} ({typeLabels[field.type]})
					{#if field.type === 'select'}
						<span>Optionen: {(field.selectOptions ?? []).join(', ')}</span>
					{/if}
					<button type="button" onclick={() => startEdit(field)}>Bearbeiten</button>
					<button type="button" onclick={() => removeField(field)}>Entfernen</button>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<form onsubmit={addField}>
	<label>
		Neues Feld
		<input type="text" bind:value={newName} required />
	</label>
	<label>
		Typ
		<select bind:value={newType}>
			{#each customFieldTypes as fieldType (fieldType)}
				<option value={fieldType}>{typeLabels[fieldType]}</option>
			{/each}
		</select>
	</label>
	{#if newType === 'select'}
		<label>
			Optionen (eine pro Zeile)
			<textarea bind:value={newOptionsText} rows="4"></textarea>
		</label>
	{/if}
	<button type="submit" disabled={newFieldInvalid}>Feld definieren</button>
	{#if newNameTaken}
		<span>Feldname bereits vergeben.</span>
	{/if}
</form>
