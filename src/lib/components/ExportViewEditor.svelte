<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatCsv } from '$lib/domain/csv';
	import {
		listParticipantFields,
		listPersonFields,
		type CustomFieldDefinition
	} from '$lib/domain/custom-field';
	import type { FilterCondition } from '$lib/domain/export-filter';
	import {
		exportFileName,
		filterOf,
		isExportViewNameDefined,
		previewFilter,
		projectExportView,
		renameExportView,
		unresolvedColumnNames,
		updateExportViewColumns,
		updateExportViewFilter,
		type ColumnSource,
		type ExportColumn,
		type ExportView
	} from '$lib/domain/export-view';
	import { openEditor } from '$lib/editor.svelte';
	import { announce } from '$lib/frame.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import { libraryState, upsertRecord } from '$lib/library.svelte';
	import { downloadCsv } from '$lib/store/csv-download';
	import Blatt from './Blatt.svelte';
	import EmptyState from './EmptyState.svelte';
	import ExportFilterEditor from './ExportFilterEditor.svelte';
	import InlineEditor from './InlineEditor.svelte';
	import Register from './Register.svelte';

	interface Props {
		view: ExportView;
	}

	let { view }: Props = $props();

	interface SourceOption {
		value: string;
		label: string;
	}

	interface SourceGroup {
		group: string;
		options: SourceOption[];
	}

	const PERSON_FIELD_PREFIX = 'personField:';
	const PARTICIPANT_FIELD_PREFIX = 'participantField:';

	const fixedSources: Record<string, ColumnSource> = {
		personName: { kind: 'personName' },
		personNote: { kind: 'personNote' },
		roles: { kind: 'roles' },
		participantNote: { kind: 'participantNote' }
	};

	const NAME_EDITOR = 'ansicht-name';

	const uid = $props.id();
	const addSourceId = `${uid}-quelle`;

	let addSourceField = $state<HTMLSelectElement | null>(null);

	// Bound and cleared after every add, so the menu falls back to its placeholder and the
	// same source can be taken twice.
	let addSource = $state('');
	let nameError = $state<string | null>(null);
	// A heading is renamed in the row it stands in, with no submit, so a rejected one
	// states its reason where it snapped back to.
	let headingError = $state<{ index: number; message: string } | null>(null);
	let columnsError = $state<string | null>(null);

	const level = $derived(view.level);
	const eventId = $derived(view.event);
	const event = $derived(eventId === undefined ? undefined : libraryState.library.events[eventId]);
	const scopeWord = $derived(level === 'person' ? 'Personen-Pool' : (event?.name ?? ''));
	const recordWord = $derived(level === 'person' ? 'Personen' : 'Teilnehmern');

	const personFields = $derived(listPersonFields(libraryState.library.customFields));
	const participantFields = $derived(
		level === 'person' || eventId === undefined
			? []
			: listParticipantFields(libraryState.library.customFields, eventId)
	);
	const sourceGroups = $derived(buildSourceGroups(personFields, participantFields));

	const preview = $derived(previewFilter(libraryState.library, level, eventId, filterOf(view)));
	const table = $derived(projectExportView(libraryState.library, view));
	const fileName = $derived(exportFileName(view));
	// The columns whose Custom Field is gone or belongs to another Veranstaltung: they stay,
	// and they export empty.
	const unresolved = $derived(
		new Set(unresolvedColumnNames(view, libraryState.library.customFields))
	);

	const backHref = $derived(
		level === 'person'
			? resolve('/stammdaten/einrichtung')
			: resolve('/event/[id]/export', { id: eventId ?? '' })
	);

	function buildSourceGroups(
		personDefinitions: CustomFieldDefinition[],
		participantDefinitions: CustomFieldDefinition[]
	): SourceGroup[] {
		const groups: SourceGroup[] = [
			{
				group: 'Person',
				options: [
					{ value: 'personName', label: 'Name' },
					{ value: 'personNote', label: 'Notiz' }
				]
			}
		];
		if (personDefinitions.length > 0) {
			groups.push({
				group: 'Person-Feld',
				options: personDefinitions.map((definition) => ({
					value: `${PERSON_FIELD_PREFIX}${definition.id}`,
					label: definition.name
				}))
			});
		}
		// The level is not a control: at Person level these two groups are simply absent.
		if (level === 'participant') {
			groups.push({
				group: 'Teilnehmer',
				options: [
					{ value: 'roles', label: 'Rollen' },
					{ value: 'participantNote', label: 'Notiz' }
				]
			});
			if (participantDefinitions.length > 0) {
				groups.push({
					group: 'Teilnehmer-Feld',
					options: participantDefinitions.map((definition) => ({
						value: `${PARTICIPANT_FIELD_PREFIX}${definition.id}`,
						label: definition.name
					}))
				});
			}
		}
		return groups;
	}

	function fieldName(definitionId: string): string {
		return libraryState.library.customFields[definitionId]?.name ?? 'Feld nicht mehr vorhanden';
	}

	function sourceLabel(source: ColumnSource): string {
		switch (source.kind) {
			case 'personName':
				return 'Person · Name';
			case 'personNote':
				return 'Person · Notiz';
			case 'personField':
				return `Person-Feld · ${fieldName(source.definitionId)}`;
			case 'roles':
				return 'Teilnehmer · Rollen';
			case 'participantNote':
				return 'Teilnehmer · Notiz';
			case 'participantField':
				return `Teilnehmer-Feld · ${fieldName(source.definitionId)}`;
		}
	}

	function decodeSource(value: string): ColumnSource {
		if (value.startsWith(PERSON_FIELD_PREFIX)) {
			return { kind: 'personField', definitionId: value.slice(PERSON_FIELD_PREFIX.length) };
		}
		if (value.startsWith(PARTICIPANT_FIELD_PREFIX)) {
			return {
				kind: 'participantField',
				definitionId: value.slice(PARTICIPANT_FIELD_PREFIX.length)
			};
		}
		return fixedSources[value];
	}

	function defaultHeading(value: string): string {
		if (value === 'personName') {
			return 'Name';
		}
		if (value === 'personNote') {
			return level === 'person' ? 'Notiz' : 'Notiz Person';
		}
		if (value === 'roles') {
			return 'Rollen';
		}
		if (value === 'participantNote') {
			return 'Notiz';
		}
		return fieldName(value.slice(value.indexOf(':') + 1));
	}

	// Repeated headings make the file unreadable back in, so a second column from the same
	// source arrives with a heading of its own rather than with an error.
	function freeHeading(wanted: string): string {
		const taken = new Set(view.columns.map((column) => column.name));
		let candidate = wanted;
		let attempt = 1;
		while (taken.has(candidate)) {
			attempt += 1;
			candidate = `${wanted} ${attempt}`;
		}
		return candidate;
	}

	/* The Ansicht's name. */

	function startRename(trigger: HTMLElement): void {
		openEditor({ id: NAME_EDITOR, trigger });
	}

	async function commitRename(typed: string): Promise<void> {
		nameError = null;
		const name = typed.trim();
		if (name === '' || name === view.name) {
			return;
		}
		if (
			isExportViewNameDefined(libraryState.library.exportViews, level, eventId, name, view.id)
		) {
			nameError = 'Name bereits vergeben.';
			return;
		}
		await upsertRecord('exportViews', renameExportView(libraryState.library.exportViews, view, name));
	}

	/* The filter and the columns — both silent, both without a Speichern button (§3). */

	async function saveFilter(conditions: FilterCondition[]): Promise<void> {
		await upsertRecord('exportViews', updateExportViewFilter(view, conditions));
	}

	async function saveColumns(columns: ExportColumn[]): Promise<void> {
		await upsertRecord('exportViews', updateExportViewColumns(view, columns));
	}

	async function addColumn(value: string): Promise<void> {
		addSource = '';
		columnsError = null;
		const column = { source: decodeSource(value), name: freeHeading(defaultHeading(value)) };
		await saveColumns([...view.columns, column]);
	}

	async function moveColumn(index: number, offset: number): Promise<void> {
		const target = index + offset;
		if (target < 0 || target >= view.columns.length) {
			return;
		}
		const reordered = [...view.columns];
		const [moved] = reordered.splice(index, 1);
		reordered.splice(target, 0, moved);
		await saveColumns(reordered);
	}

	// Never disabled, always answered: a file without a column has nothing in it, and the
	// reason is stated where the press happened rather than by a dead button (§4).
	async function removeColumn(index: number): Promise<void> {
		if (view.columns.length === 1) {
			columnsError = 'Die Datei braucht mindestens eine Spalte.';
			return;
		}
		columnsError = null;
		headingError = null;
		await saveColumns(view.columns.filter((_, position) => position !== index));
		// The row that carried the trigger is gone, so focus lands on the way a column
		// comes back rather than on nothing.
		addSourceField?.focus();
	}

	async function commitHeading(index: number, typed: string): Promise<void> {
		headingError = null;
		const heading = typed.trim();
		const column = view.columns[index];
		if (heading === column.name) {
			return;
		}
		if (heading === '') {
			headingError = { index, message: 'Eine Überschrift ist nötig.' };
			return;
		}
		// Checked on submit, never by disabling the button (§4).
		if (view.columns.some((other, position) => position !== index && other.name === heading)) {
			headingError = { index, message: 'Überschrift bereits vergeben.' };
			return;
		}
		const columns = view.columns.map((entry, position) =>
			position === index ? { source: entry.source, name: heading } : entry
		);
		await saveColumns(columns);
	}

	/* The file itself — the one act this screen exists for. */

	function download(): void {
		downloadCsv(fileName, formatCsv(table));
		// The file lands off-screen, which is the one kind of result that is reported (§3).
		announce(`Datei heruntergeladen: ${fileName} — ${table.rows.length} Zeilen`);
	}
</script>

{#snippet head()}
	<tr>
		{#each table.columns as column (column)}
			<th scope="col" class="label">{column}</th>
		{/each}
	</tr>
{/snippet}

<p class="back">
	<a href={backHref}>Export-Ansichten</a>
</p>

<div class="page-head">
	<h1>
		<InlineEditor
			id={NAME_EDITOR}
			label="Name der Ansicht"
			value={view.name}
			oncommit={commitRename}
		>
			{#snippet display()}
				<span class="name">{view.name}</span>
			{/snippet}
		</InlineEditor>
	</h1>
	<button
		type="button"
		class="icon-btn"
		data-tip="Umbenennen"
		onclick={(press) => startRename(press.currentTarget)}
	>
		<span class="vh">Ansicht „{view.name}“ umbenennen</span>
		<Icon name="pencil" label={null} />
	</button>
	<p class="meta">{scopeWord}</p>
	<button type="button" class="btn secondary" onclick={download}>
		<Icon name="download" label={null} />
		Herunterladen
	</button>
</div>

{#if nameError !== null}
	<p class="field-error">{nameError}</p>
{/if}

<!-- Filter, then Spalten, then the file: the order the file is built in, stacked rather
     than split across an axis. -->
<Blatt>
	<ExportFilterEditor {level} {eventId} conditions={filterOf(view)} onchange={saveFilter} />

	<section>
		<div class="section-head">
			<h2 class="label">Spalten</h2>
			<p class="tally">
				{view.columns.length}
				{view.columns.length === 1 ? 'Spalte' : 'Spalten'}
			</p>
		</div>

		<table>
			<thead>
				<tr>
					<th scope="col" class="label num">Nr.</th>
					<th scope="col" class="label">Überschrift in der Datei</th>
					<th scope="col" class="label">Quelle</th>
					<th scope="col" class="label"><span class="vh">Aktionen</span></th>
				</tr>
			</thead>
			<tbody>
				{#each view.columns as column, index (index)}
					<tr>
						<td class="num index">{index + 1}</td>
						<td class="heading">
							<InlineEditor
								id={`${uid}-spalte-${index}`}
								label="Überschrift in der Datei"
								value={column.name}
								oncommit={(heading) => commitHeading(index, heading)}
							/>
							{#if headingError?.index === index}
								<p class="field-error">{headingError.message}</p>
							{/if}
						</td>
						<td class="source">
							{sourceLabel(column.source)}
							{#if unresolved.has(column.name)}
								<Icon
									name="triangle-alert"
									label="Feld nicht mehr vorhanden — die Spalte bleibt leer"
								/>
							{/if}
						</td>
						<td class="actions">
							<!-- The move a row cannot make is absent rather than disabled: a
							     disabled control owes a visible reason (§0.5), and the row
							     number already is one. -->
							{#if index > 0}
								<button
									type="button"
									class="icon-btn row-action"
									data-tip="Nach oben"
									onclick={() => moveColumn(index, -1)}
								>
									<span class="vh">Spalte „{column.name}“ nach oben</span>
									<Icon name="arrow-up" label={null} />
								</button>
							{/if}
							{#if index < view.columns.length - 1}
								<button
									type="button"
									class="icon-btn row-action"
									data-tip="Nach unten"
									onclick={() => moveColumn(index, 1)}
								>
									<span class="vh">Spalte „{column.name}“ nach unten</span>
									<Icon name="arrow-down" label={null} />
								</button>
							{/if}
							<button
								type="button"
								class="icon-btn row-action"
								data-tip="Spalte entfernen"
								onclick={() => removeColumn(index)}
							>
								<span class="vh">Spalte „{column.name}“ entfernen</span>
								<Icon name="x" label={null} />
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		{#if columnsError !== null}
			<p class="field-error">{columnsError}</p>
		{/if}

		<!-- The available fields are a menu, not a standing panel — the question is asked
		     twice per Ansicht and never again. A select persists on change (§5). -->
		<div class="add">
			<label class="label" for={addSourceId}>Spalte hinzufügen</label>
			<select
				bind:this={addSourceField}
				bind:value={addSource}
				id={addSourceId}
				onchange={(pick) => addColumn(pick.currentTarget.value)}
			>
				<option value="" disabled>Quelle wählen …</option>
				{#each sourceGroups as group (group.group)}
					<optgroup label={group.group}>
						{#each group.options as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</div>
	</section>
</Blatt>

<section class="vorschau">
	<div class="section-head">
		<h2 class="label">Vorschau der Datei</h2>
		<p class="meta">
			{preview.matching} von {preview.total}
			{recordWord}, {view.columns.length}
			{view.columns.length === 1 ? 'Spalte' : 'Spalten'} · {fileName}
		</p>
	</div>

	<Register caption="Vorschau der Datei" skipTo="nach-der-vorschau" {head}>
		{#if table.rows.length === 0}
			<tr>
				<td colspan={table.columns.length}>
					<EmptyState
						tier="no-matches"
						message="Kein Datensatz erfüllt den Filter — die Datei hätte nur die Kopfzeile."
					/>
				</td>
			</tr>
		{:else}
			{#each table.rows as row, line (line)}
				<tr>
					{#each row as cell, place (place)}
						<td><span class="cell">{cell}</span></td>
					{/each}
				</tr>
			{/each}
		{/if}
	</Register>

	<!-- What the preview is honest about: it is a view of the file, not the file. An empty
	     column is shown as it is and deliberately not marked. -->
	<p id="nach-der-vorschau" class="legend" tabindex="-1">
		Zellen sind hier gekürzt — die Datei enthält den ganzen Wert. Rollen durch Komma getrennt,
		Zahlen mit Punkt: so lässt sich die Datei über eine Import-Zuordnung wieder einlesen.
	</p>
</section>

<style>
	.back {
		margin-bottom: var(--space-3);
		font-size: var(--text-sm);
	}

	.page-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		margin-bottom: var(--space-6);
	}

	h1 {
		font-size: var(--text-xl);
		font-weight: 600;
	}

	h1 :global(input) {
		width: 24rem;
		max-width: 100%;
	}

	.meta {
		margin-left: var(--space-3);
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.page-head .btn {
		margin-left: auto;
		flex: none;
		align-self: center;
	}

	.section-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-5);
		margin-bottom: var(--space-4);
	}

	.tally {
		font-size: var(--text-sm);
		color: var(--ink-mute);
		font-variant-numeric: tabular-nums;
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

	th.num,
	td.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	td.index {
		width: 3rem;
		font-family: var(--font-code);
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	td.heading {
		font-weight: 600;
	}

	td.source {
		display: flex;
		align-items: center;
		gap: var(--space-3);
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
	tr:focus-within .row-action {
		opacity: 1;
	}

	@media (pointer: coarse) {
		.row-action {
			opacity: 1;
		}
	}

	.add {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-5);
	}

	.add select {
		height: var(--row);
		padding: 0 var(--space-3);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
	}

	/* The file underneath, at full width — the Blatt above is the definition. */
	.vorschau {
		margin-top: var(--space-7);
	}

	.cell {
		display: block;
		max-width: 22rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.legend {
		margin-top: var(--space-4);
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}
</style>
