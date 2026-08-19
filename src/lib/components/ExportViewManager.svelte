<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { formatCsv } from '$lib/domain/csv';
	import { listEventsByCreation } from '$lib/domain/event';
	import {
		copyExportViewToEvent,
		defineExportView,
		duplicateExportView,
		exportFileName,
		filterOf,
		isExportViewNameDefined,
		listExportViews,
		previewFilter,
		projectExportView,
		unresolvedColumnNames,
		type ExportColumn,
		type ExportLevel,
		type ExportView,
		type UnmatchedPart
	} from '$lib/domain/export-view';
	import { closeEditor, isEditorOpen, openEditor } from '$lib/editor.svelte';
	import { announce } from '$lib/frame.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import { libraryState, removeRecords, upsertRecord } from '$lib/library.svelte';
	import { downloadCsv } from '$lib/store/csv-download';
	import Blatt from './Blatt.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import EmptyState from './EmptyState.svelte';
	import { conditionLabel } from './filter-labels';

	interface Props {
		level: ExportLevel;
		/** Required at Participant level. */
		eventId?: string;
	}

	let { level, eventId }: Props = $props();

	const uid = $props.id();
	const nameId = `${uid}-name`;
	const nameErrorId = `${uid}-name-fehler`;

	let creating = $state(false);
	let draftName = $state('');
	let nameError = $state<string | null>(null);
	let targetEventId = $state('');
	let transferError = $state<string | null>(null);
	let removing = $state<ExportView | null>(null);

	let createButton = $state<HTMLButtonElement | null>(null);
	let nameField = $state<HTMLInputElement | null>(null);
	let targetField = $state<HTMLSelectElement | null>(null);
	// Held for the whole detail row, because the row's own controls go with it when the
	// copy is taken and focus has to land back on the action that opened it.
	let transferTrigger: HTMLElement | null = null;

	const views = $derived(listExportViews(libraryState.library.exportViews, level, eventId));
	const scopeNote = $derived(
		level === 'person'
			? 'Erfassen die Personen des Pools.'
			: 'Erfassen die Teilnehmer dieser Veranstaltung.'
	);
	const emptyMessage = $derived(
		level === 'person'
			? 'Noch keine Export-Ansichten. Eine Ansicht hält fest, welche Personen der Filter erfasst und welche Felder zu Spalten werden.'
			: 'Noch keine Export-Ansichten. Eine Ansicht hält fest, welche Teilnehmer der Filter erfasst und welche Felder zu Spalten werden.'
	);

	// Übernehmen crosses into another Veranstaltung, so it exists at Teilnehmer level only.
	const targetEvents = $derived(
		level === 'person'
			? []
			: listEventsByCreation(libraryState.library.events).filter((event) => event.id !== eventId)
	);

	const openTransfer = $derived(views.find((view) => isEditorOpen(transferEditorId(view.id))));
	// A name is what identifies an Ansicht in its register, so a name the target already
	// holds is the one thing that stops the copy.
	const targetHoldsName = $derived(
		openTransfer !== undefined
		&& targetEventId !== ''
		&& isExportViewNameDefined(
			libraryState.library.exportViews,
			'participant',
			targetEventId,
			openTransfer.name
		)
	);
	/*
		The report before the click and the act itself are this one value — they cannot
		disagree, because there is nothing for them to disagree about.
	*/
	const plannedCopy = $derived.by(() => {
		if (openTransfer === undefined || targetEventId === '' || targetHoldsName) {
			return null;
		}
		return copyExportViewToEvent(libraryState.library, openTransfer, targetEventId);
	});

	function editorHref(view: ExportView): ResolvedPathname {
		return level === 'person'
			? resolve('/stammdaten/einrichtung/[viewId]', { viewId: view.id })
			: resolve('/event/[id]/export/[viewId]', { id: eventId ?? '', viewId: view.id });
	}

	function matchCount(view: ExportView): { matching: number; total: number } {
		return previewFilter(libraryState.library, level, eventId, filterOf(view));
	}

	function filterSummary(view: ExportView): string {
		const labels = filterOf(view).map((condition) =>
			conditionLabel(condition, libraryState.library.customFields, libraryState.library.roles)
		);
		return labels.join(' und ');
	}

	/* Creating — a name, then the editor, and a half-named Ansicht never becomes a record. */

	async function startCreating(): Promise<void> {
		creating = true;
		await tick();
		nameField?.focus();
	}

	function stopCreating(): void {
		creating = false;
		draftName = '';
		nameError = null;
		createButton?.focus();
	}

	async function commitCreation(submit: SubmitEvent): Promise<void> {
		submit.preventDefault();
		const name = draftName.trim();
		if (name === '') {
			nameError = 'Ein Name ist nötig.';
			nameField?.focus();
			return;
		}
		if (isExportViewNameDefined(libraryState.library.exportViews, level, eventId, name)) {
			nameError = 'Name bereits vergeben.';
			nameField?.focus();
			return;
		}
		// The Name is the column every list starts from, and an Ansicht cannot be stored
		// without one.
		const firstColumn: ExportColumn[] = [{ source: { kind: 'personName' }, name: 'Name' }];
		const view = defineExportView(
			libraryState.library.exportViews,
			level,
			eventId,
			name,
			[],
			firstColumn
		);
		await upsertRecord('exportViews', view);
		if (libraryState.writeFailure !== null) {
			return;
		}
		stopCreating();
		await goto(editorHref(view));
	}

	async function duplicate(view: ExportView): Promise<void> {
		await upsertRecord(
			'exportViews',
			duplicateExportView(libraryState.library.exportViews, view)
		);
	}

	/* The download — the act the screen exists for, and the one it reports. */

	function download(view: ExportView): void {
		const table = projectExportView(libraryState.library, view);
		const fileName = exportFileName(view);
		downloadCsv(fileName, formatCsv(table));
		// The file lands off-screen, which is why this write says anything at all (§3).
		announce(`Datei heruntergeladen: ${fileName} — ${table.rows.length} Zeilen`);
	}

	/* Übernehmen — an inset detail row, never a dialog (§7). */

	function transferEditorId(viewId: string): string {
		return `uebernehmen-${viewId}`;
	}

	function toggleTransfer(view: ExportView, trigger: HTMLElement): void {
		targetEventId = '';
		transferError = null;
		if (isEditorOpen(transferEditorId(view.id))) {
			closeEditor(transferEditorId(view.id));
			trigger.focus();
			return;
		}
		transferTrigger = trigger;
		openEditor({ id: transferEditorId(view.id), trigger });
	}

	function fieldName(definitionId: string): string {
		return libraryState.library.customFields[definitionId]?.name ?? 'Feld nicht mehr vorhanden';
	}

	function unmatchedSentence(part: UnmatchedPart): string {
		if (part.kind === 'column') {
			const source = part.column.source;
			const name =
				source.kind === 'participantField' ? fieldName(source.definitionId) : part.column.name;
			return `Spalte „${part.column.name}“ — Teilnehmer-Feld „${name}“ gibt es dort nicht`;
		}
		const label = conditionLabel(
			part.condition,
			libraryState.library.customFields,
			libraryState.library.roles
		);
		const what = part.condition.kind === 'role' ? 'Rolle' : 'Teilnehmer-Feld';
		return `Bedingung „${label}“ — ${what} gibt es dort nicht`;
	}

	async function transfer(view: ExportView): Promise<void> {
		if (targetEventId === '') {
			transferError = 'Eine Veranstaltung ist nötig.';
			targetField?.focus();
			return;
		}
		// That the target already holds this name is stated above the button, so the press
		// only puts focus where the answer is.
		if (plannedCopy === null) {
			targetField?.focus();
			return;
		}
		const target = libraryState.library.events[targetEventId];
		const unmatchedCount = plannedCopy.unmatched.length;
		await upsertRecord('exportViews', plannedCopy.view);
		if (libraryState.writeFailure !== null) {
			return;
		}
		// The result lands in another Veranstaltung, off this screen (§3).
		const loss = unmatchedCount === 0 ? '' : ` — ${unmatchedCount} ohne Entsprechung`;
		announce(`„${view.name}“ nach „${target.name}“ übernommen${loss}`);
		closeEditor(transferEditorId(view.id));
		transferTrigger?.focus();
	}

	async function removeView(view: ExportView): Promise<void> {
		await removeRecords([{ section: 'exportViews', id: view.id }]);
		if (libraryState.writeFailure !== null) {
			return;
		}
		createButton?.focus();
	}
</script>

{#snippet createAction()}
	<button type="button" class="btn primary" onclick={startCreating}>
		<Icon name="plus" label={null} />
		Neue Ansicht
	</button>
{/snippet}

<Blatt>
	<section>
		<div class="section-head">
			<h2 class="label">
				<Icon name="file-output" label={null} />
				Export-Ansichten
			</h2>
			<p class="note">{scopeNote}</p>
			<button bind:this={createButton} type="button" class="btn primary" onclick={startCreating}>
				<Icon name="plus" label={null} />
				Neue Ansicht
			</button>
		</div>

		<!-- Inline, not a dialog: nothing here blocks the organizer's work (§7). -->
		{#if creating}
			<form class="create" onsubmit={commitCreation}>
				<div class="field">
					<label class="label" for={nameId}>Name</label>
					<input
						bind:this={nameField}
						bind:value={draftName}
						id={nameId}
						type="text"
						placeholder="z. B. Küchenliste"
						aria-invalid={nameError !== null ? 'true' : undefined}
						aria-describedby={nameError !== null ? nameErrorId : `${uid}-anlegen-hinweis`}
						oninput={() => (nameError = null)}
					/>
					{#if nameError !== null}
						<p id={nameErrorId} class="field-error">{nameError}</p>
					{:else}
						<p id="{uid}-anlegen-hinweis" class="note">
							Die Ansicht öffnet sich danach mit der Spalte „Name“.
						</p>
					{/if}
				</div>
				<div class="commit">
					<button type="submit" class="btn primary">Anlegen</button>
					<button type="button" class="btn quiet" onclick={stopCreating}>Abbrechen</button>
				</div>
			</form>
		{/if}

		{#if views.length === 0}
			<EmptyState
				tier="nothing-yet"
				icon="file-output"
				message={emptyMessage}
				action={createAction}
			/>
		{:else}
			<table>
				<thead>
					<tr>
						<th scope="col" class="label">Ansicht</th>
						<th scope="col" class="label">Spalten</th>
						<th scope="col" class="label">Filter</th>
						<th scope="col" class="label num">Treffer</th>
						<th scope="col" class="label"><span class="vh">Aktionen</span></th>
					</tr>
				</thead>
				<tbody>
					{#each views as view (view.id)}
						{@const open = isEditorOpen(transferEditorId(view.id))}
						{@const detailId = `uebernehmen-detail-${view.id}`}
						{@const summary = filterSummary(view)}
						{@const treffer = matchCount(view)}
						{@const unresolved = new Set(
							unresolvedColumnNames(view, libraryState.library.customFields)
						)}
						<tr class:open>
							<td class="name">
								<a href={editorHref(view)}>{view.name}</a>
							</td>
							<td class="spalten">
								<span class="chips">
									{#each view.columns as column (column.name)}
										<span class="chip" class:gone={unresolved.has(column.name)}>
											{column.name}
											{#if unresolved.has(column.name)}
												<Icon
													name="triangle-alert"
													label="Feld nicht mehr vorhanden — die Spalte bleibt leer"
												/>
											{/if}
										</span>
									{/each}
								</span>
							</td>
							<td class="filter">{summary === '' ? 'alle Datensätze' : summary}</td>
							<!-- Live against the Library, so the register says how big each file is
							     before it is opened. -->
							<td class="num treffer">
								{treffer.matching}<span class="of">/{treffer.total}</span>
							</td>
							<td class="actions">
								<!-- The single primary action of the row stays visible: hiding the one
								     thing the screen exists for is concealment, not density (§6). -->
								<button type="button" class="btn secondary" onclick={() => download(view)}>
									<Icon name="download" label={null} />
									Herunterladen
								</button>
								<a class="icon-btn row-action" data-tip="Bearbeiten" href={editorHref(view)}>
									<span class="vh">Ansicht „{view.name}“ bearbeiten</span>
									<Icon name="pencil" label={null} />
								</a>
								<button
									type="button"
									class="icon-btn row-action"
									data-tip="Duplizieren"
									onclick={() => duplicate(view)}
								>
									<span class="vh">Ansicht „{view.name}“ duplizieren</span>
									<Icon name="copy" label={null} />
								</button>
								{#if level === 'participant' && targetEvents.length > 0}
									<button
										type="button"
										class="icon-btn row-action"
										data-tip="In andere Veranstaltung übernehmen"
										aria-expanded={open}
										aria-controls={detailId}
										onclick={(press) => toggleTransfer(view, press.currentTarget)}
									>
										<span class="vh">
											Ansicht „{view.name}“ in eine andere Veranstaltung übernehmen
										</span>
										<Icon name="calendar-plus" label={null} />
									</button>
								{/if}
								<button
									type="button"
									class="icon-btn row-action destructive"
									data-tip="Ansicht entfernen"
									onclick={() => (removing = view)}
								>
									<span class="vh">Ansicht „{view.name}“ entfernen</span>
									<Icon name="trash-2" label={null} />
								</button>
							</td>
						</tr>

						{#if open}
							<tr class="detail" id={detailId}>
								<td colspan="5">
									<div class="transfer">
										<div class="field">
											<label class="label" for="{uid}-ziel-{view.id}">Nach Veranstaltung</label>
											<select
												bind:this={targetField}
												bind:value={targetEventId}
												id="{uid}-ziel-{view.id}"
												aria-invalid={transferError !== null ? 'true' : undefined}
												aria-describedby={transferError !== null
													? `${uid}-ziel-fehler-${view.id}`
													: undefined}
												onchange={() => (transferError = null)}
											>
												<option value="" disabled>Veranstaltung wählen …</option>
												{#each targetEvents as target (target.id)}
													<option value={target.id}>{target.name}</option>
												{/each}
											</select>
											{#if transferError !== null}
												<p id="{uid}-ziel-fehler-{view.id}" class="field-error">
													{transferError}
												</p>
											{/if}
										</div>

										{#if targetHoldsName}
											<p class="field-error">
												Dort gibt es bereits eine Ansicht „{view.name}“.
											</p>
										{:else if plannedCopy !== null}
											{#if plannedCopy.unmatched.length === 0}
												<p class="note">Alles hat dort eine Entsprechung.</p>
											{:else}
												<div class="report">
													<p class="label">Was dort fehlt</p>
													<ul>
														{#each plannedCopy.unmatched as part, place (place)}
															<li>
																<Icon name="triangle-alert" label={null} />
																{unmatchedSentence(part)}
															</li>
														{/each}
													</ul>
													<!-- The copy takes everything anyway: a column that
													     quietly vanished is one the organizer must notice
													     and rebuild. -->
													<p class="note">
														Spalten ohne Entsprechung bleiben erhalten und exportieren leer.
														Bedingungen ohne Entsprechung entfallen.
													</p>
												</div>
											{/if}
										{/if}

										<button type="button" class="btn primary" onclick={() => transfer(view)}>
											<Icon name="calendar-plus" label={null} />
											Übernehmen
										</button>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>

			<!-- A statement, not a control: nothing here offers to build a Zuordnung. -->
			<p class="note footer">
				Die heruntergeladene Datei lässt sich über eine Import-Zuordnung wieder einlesen.
			</p>
		{/if}
	</section>
</Blatt>

{#if removing !== null}
	{@const target = removing}
	<ConfirmDialog
		title="Export-Ansicht entfernen"
		confirmLabel="Entfernen"
		onconfirm={() => removeView(target)}
		onclose={() => (removing = null)}
	>
		Die Ansicht „{target.name}“ wird entfernt. Die Daten dahinter und bereits
		heruntergeladene Dateien bleiben unberührt.
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

	.note {
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
		width: 18rem;
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

	tbody tr:hover {
		background: var(--hover);
	}

	tbody tr.open {
		background: var(--selected);
	}

	th.num,
	td.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
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

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	/* Static, not a control: the columns are what the file carries, read at a glance. */
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		background: var(--raised);
		border: 1px solid var(--rule);
		border-radius: var(--radius);
		font-family: var(--font-code);
		font-size: var(--text-xs);
		letter-spacing: var(--track-code);
		color: var(--ink-mute);
	}

	.chip.gone {
		border-style: dashed;
	}

	td.filter {
		color: var(--ink-mute);
	}

	td.treffer {
		font-family: var(--font-code);
		white-space: nowrap;
	}

	.of {
		color: var(--ink-mute);
	}

	td.actions {
		width: 0;
		white-space: nowrap;
		text-align: right;
	}

	td.actions .btn {
		margin-right: var(--space-3);
		vertical-align: middle;
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

	.transfer {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-6);
	}

	.transfer .btn {
		margin-left: auto;
	}

	.report {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}

	.report ul {
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-sm);
	}

	.report li {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
	}

	.footer {
		margin-top: var(--space-4);
	}
</style>
