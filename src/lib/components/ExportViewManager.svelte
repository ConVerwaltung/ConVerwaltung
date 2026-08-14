<script lang="ts">
	import { formatCsv } from '$lib/domain/csv';
	import {
		listParticipantFields,
		listPersonFields,
		type CustomFieldDefinition
	} from '$lib/domain/custom-field';
	import type { FilterCondition } from '$lib/domain/export-filter';
	import {
		defineExportView,
		exportFileName,
		filterOf,
		isExportViewNameDefined,
		listExportViews,
		projectExportView,
		unresolvedColumnNames,
		type ColumnSource,
		type ExportColumn,
		type ExportLevel,
		type ExportView
	} from '$lib/domain/export-view';
	import type { RecordKey } from '$lib/domain/library';
	import { libraryState, removeRecords, upsertRecord } from '$lib/library.svelte';
	import { downloadCsv } from '$lib/store/csv-download';
	import ExportFilterEditor from './ExportFilterEditor.svelte';
	import { conditionLabel } from './filter-labels';

	interface Props {
		level: ExportLevel;
		/** Required at Participant level. */
		eventId?: string;
	}

	let { level, eventId }: Props = $props();

	interface SourceOption {
		value: string;
		label: string;
	}

	interface DraftColumn {
		source: string;
		name: string;
	}

	const PERSON_FIELD_PREFIX = 'personField:';
	const PARTICIPANT_FIELD_PREFIX = 'participantField:';

	const fixedSources: Record<string, ColumnSource> = {
		personName: { kind: 'personName' },
		personNote: { kind: 'personNote' },
		roles: { kind: 'roles' },
		participantNote: { kind: 'participantNote' }
	};

	let draftColumns: DraftColumn[] = $state([]);
	let draftFilter: FilterCondition[] = $state([]);
	let newSource = $state('personName');
	let viewName = $state('');

	const personFields = $derived(listPersonFields(libraryState.library.customFields));
	const participantFields = $derived(
		eventId === undefined ? [] : listParticipantFields(libraryState.library.customFields, eventId)
	);
	const sourceOptions = $derived(buildSourceOptions(personFields, participantFields));
	const views = $derived(listExportViews(libraryState.library.exportViews, level, eventId));
	const nameTaken = $derived(
		isExportViewNameDefined(libraryState.library.exportViews, level, eventId, viewName)
	);
	const columnNames = $derived(draftColumns.map((column) => column.name.trim()));
	const duplicateNames = $derived(
		columnNames.filter((name, index) => name !== '' && columnNames.indexOf(name) !== index)
	);
	const saveInvalid = $derived(
		viewName.trim() === ''
		|| nameTaken
		|| draftColumns.length === 0
		|| columnNames.some((name) => name === '')
		|| duplicateNames.length > 0
	);

	function buildSourceOptions(
		personDefinitions: CustomFieldDefinition[],
		participantDefinitions: CustomFieldDefinition[]
	): SourceOption[] {
		const options: SourceOption[] = [
			{ value: 'personName', label: 'Person: Name' },
			{ value: 'personNote', label: 'Person: Notiz' }
		];
		for (const definition of personDefinitions) {
			options.push({
				value: `${PERSON_FIELD_PREFIX}${definition.id}`,
				label: `Person-Feld: ${definition.name}`
			});
		}
		if (level === 'participant') {
			options.push({ value: 'roles', label: 'Teilnehmer: Rollen' });
			options.push({ value: 'participantNote', label: 'Teilnehmer: Notiz' });
			for (const definition of participantDefinitions) {
				options.push({
					value: `${PARTICIPANT_FIELD_PREFIX}${definition.id}`,
					label: `Teilnehmer-Feld: ${definition.name}`
				});
			}
		}
		return options;
	}

	function sourceLabel(source: string): string {
		const option = sourceOptions.find((entry) => entry.value === source);
		return option === undefined ? source : option.label;
	}

	function decodeSource(source: string): ColumnSource {
		if (source.startsWith(PERSON_FIELD_PREFIX)) {
			return { kind: 'personField', definitionId: source.slice(PERSON_FIELD_PREFIX.length) };
		}
		if (source.startsWith(PARTICIPANT_FIELD_PREFIX)) {
			return {
				kind: 'participantField',
				definitionId: source.slice(PARTICIPANT_FIELD_PREFIX.length)
			};
		}
		return fixedSources[source];
	}

	function defaultColumnName(source: string): string {
		if (source === 'personName') {
			return 'Name';
		}
		if (source === 'personNote') {
			return level === 'person' ? 'Notiz' : 'Notiz Person';
		}
		if (source === 'roles') {
			return 'Rollen';
		}
		if (source === 'participantNote') {
			return 'Notiz';
		}
		const definitionId = source.slice(source.indexOf(':') + 1);
		return libraryState.library.customFields[definitionId].name;
	}

	function addColumn() {
		const column = { source: newSource, name: defaultColumnName(newSource) };
		draftColumns = [...draftColumns, column];
	}

	function moveColumn(index: number, offset: number) {
		const target = index + offset;
		if (target < 0 || target >= draftColumns.length) {
			return;
		}
		const reordered = [...draftColumns];
		const [moved] = reordered.splice(index, 1);
		reordered.splice(target, 0, moved);
		draftColumns = reordered;
	}

	function removeColumn(index: number) {
		draftColumns = draftColumns.filter((_, position) => position !== index);
	}

	function draftColumnsAsColumns(): ExportColumn[] {
		return draftColumns.map((column) => {
			const source = decodeSource(column.source);
			return { source, name: column.name };
		});
	}

	async function saveView(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (saveInvalid) {
			return;
		}
		const columns = draftColumnsAsColumns();
		const view = defineExportView(
			libraryState.library.exportViews,
			level,
			eventId,
			viewName,
			draftFilter,
			columns
		);
		await upsertRecord('exportViews', view);
		viewName = '';
		draftFilter = [];
		draftColumns = [];
	}

	function filterSummary(view: ExportView): string {
		const labels = filterOf(view).map((condition) =>
			conditionLabel(condition, libraryState.library.customFields, libraryState.library.roles)
		);
		return labels.join(' und ');
	}

	function runView(view: ExportView) {
		const table = projectExportView(libraryState.library, view);
		const text = formatCsv(table);
		downloadCsv(exportFileName(view), text);
	}

	async function removeView(view: ExportView) {
		const confirmed = window.confirm(
			`Export-Ansicht „${view.name}“ entfernen?\nDie exportierten Daten bleiben unberührt.`
		);
		if (!confirmed) {
			return;
		}
		const deletions: RecordKey[] = [{ section: 'exportViews', id: view.id }];
		await removeRecords(deletions);
	}
</script>

<h2>Export-Ansichten</h2>
{#if level === 'participant'}
	<p>Diese Export-Ansichten erfassen die Teilnehmer dieser Veranstaltung.</p>
{:else}
	<p>Diese Export-Ansichten erfassen alle Personen des Pools.</p>
{/if}

{#if views.length === 0}
	<p>Noch keine Export-Ansichten definiert.</p>
{:else}
	<ul>
		{#each views as view (view.id)}
			{@const unresolved = unresolvedColumnNames(view, libraryState.library.customFields)}
			{@const summary = filterSummary(view)}
			<li>
				{view.name}
				<small>Spalten: {view.columns.map((column) => column.name).join(', ')}</small>
				{#if summary === ''}
					<small>Filter: alle Datensätze</small>
				{:else}
					<small>Filter: {summary}</small>
				{/if}
				<button type="button" onclick={() => runView(view)}>CSV herunterladen</button>
				<button type="button" onclick={() => removeView(view)}>Entfernen</button>
				{#if unresolved.length > 0}
					<span>
						Feld nicht mehr vorhanden, Spalten bleiben leer: {unresolved.join(', ')}
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<form onsubmit={saveView}>
	<h3>Neue Export-Ansicht</h3>
	<label>
		Name
		<input type="text" bind:value={viewName} required />
	</label>
	{#if nameTaken}
		<span>Name bereits vergeben.</span>
	{/if}

	<ExportFilterEditor {level} {eventId} bind:conditions={draftFilter} />

	<h5>Spalten</h5>
	<label>
		Spalte aus
		<select bind:value={newSource}>
			{#each sourceOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
	<button type="button" onclick={addColumn}>Spalte hinzufügen</button>

	{#if draftColumns.length === 0}
		<p>Noch keine Spalten gewählt.</p>
	{:else}
		<ol>
			{#each draftColumns as column, index (index)}
				<li>
					<label>
						Überschrift
						<input type="text" bind:value={draftColumns[index].name} required />
					</label>
					<span>{sourceLabel(column.source)}</span>
					<button type="button" onclick={() => moveColumn(index, -1)} disabled={index === 0}>
						Nach oben
					</button>
					<button
						type="button"
						onclick={() => moveColumn(index, 1)}
						disabled={index === draftColumns.length - 1}
					>
						Nach unten
					</button>
					<button type="button" onclick={() => removeColumn(index)}>Entfernen</button>
				</li>
			{/each}
		</ol>
	{/if}
	{#if duplicateNames.length > 0}
		<p>Überschriften müssen eindeutig sein: {duplicateNames.join(', ')}</p>
	{/if}

	<button type="submit" disabled={saveInvalid}>Export-Ansicht speichern</button>
</form>
