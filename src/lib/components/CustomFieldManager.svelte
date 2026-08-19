<script lang="ts">
	import { tick } from 'svelte';
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
	import type { RecordPut } from '$lib/domain/library';
	import { closeEditor, isEditorOpen, openEditor, revertible } from '$lib/editor.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import { commitBatch, libraryState, upsertRecord } from '$lib/library.svelte';
	import Blatt from './Blatt.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import EmptyState from './EmptyState.svelte';
	import InlineEditor from './InlineEditor.svelte';

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

	const uid = $props.id();
	const nameId = `${uid}-name`;
	const nameErrorId = `${uid}-name-fehler`;
	const newTypeId = `${uid}-typ`;
	const newOptionsId = `${uid}-optionen`;
	const newOptionsErrorId = `${uid}-optionen-fehler`;
	const typeId = `${uid}-feld-typ`;
	const typeReasonId = `${uid}-feld-typ-grund`;
	const optionsId = `${uid}-feld-optionen`;
	const optionsErrorId = `${uid}-feld-optionen-fehler`;

	let creating = $state(false);
	let draftName = $state('');
	let draftType = $state<CustomFieldType>('text');
	let draftOptionsText = $state('');
	let nameError = $state<string | null>(null);
	let draftOptionsError = $state<string | null>(null);
	// The rename is an in-row swap with no submit, so a rejected name states its reason at
	// the row it snapped back into.
	let renameError = $state<{ id: string; message: string } | null>(null);
	// A type change to Auswahl cannot be stored before an option exists, so it waits at the
	// options field instead of asking for a Speichern button.
	let typeDraft = $state<CustomFieldType | null>(null);
	let optionsError = $state<string | null>(null);
	let removing = $state<CustomFieldDefinition | null>(null);

	let createButton = $state<HTMLButtonElement | null>(null);
	let nameField = $state<HTMLInputElement | null>(null);
	let newOptionsField = $state<HTMLTextAreaElement | null>(null);
	let optionsField = $state<HTMLTextAreaElement | null>(null);

	const heading = $derived(level === 'person' ? 'Person-Felder' : 'Teilnehmer-Felder');
	const scopeIcon = $derived(level === 'person' ? 'globe' : 'calendar');
	const scopeNote = $derived(
		level === 'person'
			? 'Gelten für jede Person, in jeder Veranstaltung.'
			: 'Gelten nur für die Teilnehmer dieser Veranstaltung.'
	);
	const emptyMessage = $derived(
		level === 'person'
			? 'Noch keine Person-Felder. Ein Feld ist ein benannter, getypter Platz für alles, was an einer Person hängt und in keiner Veranstaltung anders ist.'
			: 'Noch keine Teilnehmer-Felder. Ein Feld ist ein benannter, getypter Platz für alles, was nur in dieser Veranstaltung gilt.'
	);

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

	function optionsTextOf(definition: CustomFieldDefinition): string {
		return (definition.selectOptions ?? []).join('\n');
	}

	function describeOptions(definition: CustomFieldDefinition): string {
		return definition.type === 'select' ? (definition.selectOptions ?? []).join(', ') : '–';
	}

	/* Creating a field — a draft until submitted, and validity never disables the button. */

	async function startCreating(): Promise<void> {
		creating = true;
		await tick();
		nameField?.focus();
	}

	function stopCreating(): void {
		creating = false;
		draftName = '';
		draftType = 'text';
		draftOptionsText = '';
		nameError = null;
		draftOptionsError = null;
		createButton?.focus();
	}

	function defineField(name: string, options: readonly string[]): CustomFieldDefinition {
		return level === 'person'
			? definePersonField(libraryState.library.customFields, name, draftType, options)
			: defineParticipantField(
					libraryState.library.customFields,
					eventId,
					name,
					draftType,
					options
				);
	}

	async function commitCreation(submit: SubmitEvent): Promise<void> {
		submit.preventDefault();
		const name = draftName.trim();
		if (name === '') {
			nameError = 'Ein Name ist nötig.';
			nameField?.focus();
			return;
		}
		if (isNameTaken(name)) {
			nameError = 'Feldname bereits vergeben.';
			nameField?.focus();
			return;
		}
		const options = parseSelectOptions(draftOptionsText);
		if (draftType === 'select' && options.length === 0) {
			draftOptionsError = 'Mindestens eine Option ist nötig.';
			newOptionsField?.focus();
			return;
		}
		await upsertRecord('customFields', defineField(name, options));
		if (libraryState.writeFailure !== null) {
			return;
		}
		stopCreating();
	}

	/* The name — the in-row swap, silent on success like every edit of a stored record. */

	function renameEditorId(definitionId: string): string {
		return `feld-name-${definitionId}`;
	}

	async function commitRename(definition: CustomFieldDefinition, typed: string): Promise<void> {
		renameError = null;
		const name = typed.trim();
		if (name === '' || name === definition.name) {
			return;
		}
		if (isNameTaken(name)) {
			renameError = { id: definition.id, message: 'Feldname bereits vergeben.' };
			return;
		}
		await upsertRecord(
			'customFields',
			renameCustomField(libraryState.library.customFields, definition, name)
		);
	}

	/* Type and options — the multi-field edit, in the expanded detail row. */

	function detailEditorId(definitionId: string): string {
		return `feld-detail-${definitionId}`;
	}

	function isDetailOpen(definitionId: string): boolean {
		return isEditorOpen(detailEditorId(definitionId));
	}

	function toggleDetail(definitionId: string, trigger: HTMLElement): void {
		if (isDetailOpen(definitionId)) {
			closeEditor(detailEditorId(definitionId));
			trigger.focus();
			return;
		}
		typeDraft = null;
		optionsError = null;
		openEditor({ id: detailEditorId(definitionId), trigger });
	}

	async function chooseType(
		definition: CustomFieldDefinition,
		chosen: CustomFieldType
	): Promise<void> {
		optionsError = null;
		if (chosen === definition.type) {
			typeDraft = null;
			return;
		}
		if (chosen === 'select') {
			typeDraft = 'select';
			await tick();
			optionsField?.focus();
			return;
		}
		typeDraft = null;
		await upsertRecord('customFields', changeCustomFieldType(valuedRecords, definition, chosen));
	}

	async function commitOptions(definition: CustomFieldDefinition, typed: string): Promise<void> {
		const options = parseSelectOptions(typed);
		if (options.length === 0) {
			optionsError = 'Mindestens eine Option ist nötig.';
			return;
		}
		const stillUsed = listUsedCustomValues(valuedRecords, definition.id).filter(
			(value) => !options.includes(value)
		);
		if (stillUsed.length > 0) {
			optionsError = `Noch eingetragene Optionen bleiben: ${stillUsed.join(', ')}`;
			return;
		}
		const updated =
			typeDraft === 'select'
				? changeCustomFieldType(valuedRecords, definition, 'select', options)
				: editSelectOptions(valuedRecords, definition, options);
		optionsError = null;
		typeDraft = null;
		await upsertRecord('customFields', updated);
	}

	/* Removal — the values are off-screen, so the dialog counts them before the click. */

	function removalCascade(valueCount: number): string {
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

	async function removePersonField(definition: CustomFieldDefinition): Promise<void> {
		const { deletions, clearedRecords } = removeCustomFieldDefinition(
			libraryState.library.persons,
			definition.id
		);
		const puts: RecordPut[] = clearedRecords.map((person) => ({ section: 'persons', record: person }));
		await commitBatch({ puts, deletes: deletions });
	}

	async function removeParticipantField(definition: CustomFieldDefinition): Promise<void> {
		const { deletions, clearedRecords } = removeCustomFieldDefinition(
			libraryState.library.participants,
			definition.id
		);
		const puts: RecordPut[] = clearedRecords.map((participant) => ({
			section: 'participants',
			record: participant
		}));
		await commitBatch({ puts, deletes: deletions });
	}

	// The row that carried the trigger goes with the field, so focus lands on the manager's
	// own action instead of on nothing.
	async function removeField(definition: CustomFieldDefinition): Promise<void> {
		if (level === 'person') {
			await removePersonField(definition);
		} else {
			await removeParticipantField(definition);
		}
		if (libraryState.writeFailure !== null) {
			return;
		}
		createButton?.focus();
	}
</script>

{#snippet createAction()}
	<button type="button" class="btn primary" onclick={startCreating}>
		<Icon name="plus" label={null} />
		Feld definieren
	</button>
{/snippet}

<!-- A section manager renders <h2> and stops there: it is always a section, never a page. -->
<Blatt>
	<section>
		<div class="section-head">
			<h2 class="label">
				<Icon name={scopeIcon} label={null} />
				{heading}
			</h2>
			<p class="note">{scopeNote}</p>
			<button bind:this={createButton} type="button" class="btn primary" onclick={startCreating}>
				<Icon name="plus" label={null} />
				Feld definieren
			</button>
		</div>

		{#if creating}
			<form class="create" onsubmit={commitCreation}>
				<div class="field">
					<label class="label" for={nameId}>Name</label>
					<input
						bind:this={nameField}
						bind:value={draftName}
						id={nameId}
						type="text"
						placeholder="z. B. Verpflegung"
						aria-invalid={nameError !== null ? 'true' : undefined}
						aria-describedby={nameError !== null ? nameErrorId : undefined}
						oninput={() => (nameError = null)}
					/>
					{#if nameError !== null}
						<p id={nameErrorId} class="field-error">{nameError}</p>
					{/if}
				</div>

				<div class="field">
					<label class="label" for={newTypeId}>Typ</label>
					<select bind:value={draftType} id={newTypeId}>
						{#each customFieldTypes as fieldType (fieldType)}
							<option value={fieldType}>{typeLabels[fieldType]}</option>
						{/each}
					</select>
				</div>

				{#if draftType === 'select'}
					<div class="field">
						<label class="label" for={newOptionsId}>Optionen — eine pro Zeile</label>
						<textarea
							bind:this={newOptionsField}
							bind:value={draftOptionsText}
							id={newOptionsId}
							rows="4"
							aria-invalid={draftOptionsError !== null ? 'true' : undefined}
							aria-describedby={draftOptionsError !== null ? newOptionsErrorId : undefined}
							oninput={() => (draftOptionsError = null)}
						></textarea>
						{#if draftOptionsError !== null}
							<p id={newOptionsErrorId} class="field-error">{draftOptionsError}</p>
						{/if}
					</div>
				{/if}

				<div class="commit">
					<button type="submit" class="btn primary">Definieren</button>
					<button type="button" class="btn quiet" onclick={stopCreating}>Abbrechen</button>
				</div>
			</form>
		{/if}

		{#if fields.length === 0}
			<EmptyState
				tier="nothing-yet"
				icon={scopeIcon}
				message={emptyMessage}
				action={createAction}
			/>
		{:else}
			<table>
				<thead>
					<tr>
						<th scope="col" class="label">Feld</th>
						<th scope="col" class="label">Typ</th>
						<th scope="col" class="label">Optionen</th>
						<th scope="col" class="label num">Werte</th>
						<th scope="col" class="label"><span class="vh">Aktionen</span></th>
					</tr>
				</thead>
				<tbody>
					{#each fields as field (field.id)}
						{@const open = isDetailOpen(field.id)}
						{@const detailId = `feld-${field.id}`}
						<tr class:open>
							<td class="name">
								<InlineEditor
									id={renameEditorId(field.id)}
									label="Name des Feldes"
									value={field.name}
									oncommit={(name) => commitRename(field, name)}
								/>
								{#if renameError?.id === field.id}
									<p class="field-error">{renameError.message}</p>
								{/if}
							</td>
							<td class="type">{typeLabels[field.type]}</td>
							<td class="options">{describeOptions(field)}</td>
							<td class="num">{countCustomValues(valuedRecords, field.id)}</td>
							<td class="actions">
								<button
									type="button"
									class="icon-btn row-action"
									data-tip={open ? 'Schließen' : 'Typ und Optionen'}
									aria-expanded={open}
									aria-controls={detailId}
									onclick={(press) => toggleDetail(field.id, press.currentTarget)}
								>
									<span class="vh">
										Typ und Optionen von „{field.name}“ {open ? 'schließen' : 'bearbeiten'}
									</span>
									<Icon name={open ? 'chevron-down' : 'pencil'} label={null} />
								</button>
								<button
									type="button"
									class="icon-btn row-action destructive"
									data-tip="Feld entfernen"
									onclick={() => (removing = field)}
								>
									<span class="vh">Feld „{field.name}“ entfernen</span>
									<Icon name="trash-2" label={null} />
								</button>
							</td>
						</tr>
						{#if open}
							{@const hasValues = countCustomValues(valuedRecords, field.id) > 0}
							{@const shownType = typeDraft ?? field.type}
							<tr class="detail" id={detailId}>
								<td colspan="5">
									<div class="detail-grid">
										<div class="field">
											<label class="label" for={typeId}>Typ</label>
											<select
												id={typeId}
												value={shownType}
												disabled={hasValues}
												aria-describedby={hasValues ? typeReasonId : undefined}
												onchange={(pick) =>
													chooseType(field, pick.currentTarget.value as CustomFieldType)}
											>
												{#each customFieldTypes as fieldType (fieldType)}
													<option value={fieldType}>{typeLabels[fieldType]}</option>
												{/each}
											</select>
											{#if hasValues}
												<p id={typeReasonId} class="hint">
													Nicht änderbar, solange Werte eingetragen sind.
												</p>
											{/if}
										</div>

										{#if shownType === 'select'}
											<div class="field">
												<label class="label" for={optionsId}>Optionen — eine pro Zeile</label>
												<!-- In a textarea Enter is a newline, so blur is the commit (§5). -->
												<textarea
													bind:this={optionsField}
													id={optionsId}
													rows="5"
													value={optionsTextOf(field)}
													aria-invalid={optionsError !== null ? 'true' : undefined}
													aria-describedby={optionsError !== null ? optionsErrorId : undefined}
													onblur={(edit) => commitOptions(field, edit.currentTarget.value)}
													use:revertible={() => optionsTextOf(field)}
												></textarea>
												{#if optionsError !== null}
													<p id={optionsErrorId} class="field-error">{optionsError}</p>
												{:else if typeDraft === 'select'}
													<p class="hint">
														Der Typ wechselt, sobald mindestens eine Option eingetragen ist.
													</p>
												{/if}
											</div>
										{/if}
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</Blatt>

{#if removing !== null}
	{@const target = removing}
	<ConfirmDialog
		title="Feld entfernen"
		confirmLabel="Entfernen"
		onconfirm={() => removeField(target)}
		onclose={() => (removing = null)}
	>
		Das Feld „{target.name}“ wird entfernt.
		{removalCascade(countCustomValues(valuedRecords, target.id))}
	</ConfirmDialog>
{/if}

<style>
	.section-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-5);
		margin-bottom: var(--space-5);
	}

	h2 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		white-space: nowrap;
	}

	.note,
	.hint {
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.section-head .btn {
		margin-left: auto;
		flex: none;
		align-self: center;
	}

	.create {
		display: flex;
		align-items: flex-start;
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
		min-width: 0;
	}

	.create .field input {
		width: 16rem;
		max-width: 100%;
	}

	input,
	select {
		height: var(--row);
		padding: 0 var(--space-3);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
	}

	textarea {
		width: 18rem;
		max-width: 100%;
		padding: var(--space-3);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
		font-size: var(--text-sm);
		line-height: 1.5;
		resize: vertical;
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

	tbody tr.open {
		background: var(--selected);
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

	td.type,
	td.options {
		color: var(--ink-mute);
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
	tr:focus-within .row-action,
	tr.open .row-action {
		opacity: 1;
	}

	@media (pointer: coarse) {
		.row-action {
			opacity: 1;
		}
	}

	tr.detail > td {
		height: auto;
		padding: var(--space-5) var(--space-3);
		background: var(--inset);
	}

	.detail-grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-7);
	}
</style>
