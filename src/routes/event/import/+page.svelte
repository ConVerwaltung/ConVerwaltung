<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { parseCsv, type CsvTable } from '$lib/domain/csv';
	import { listParticipantFields, listPersonFields } from '$lib/domain/custom-field';
	import {
		defineImportMapping,
		isImportMappingNameDefined,
		listImportMappingsByName,
		missingMappedColumns,
		type ColumnTarget,
		type ImportMapping
	} from '$lib/domain/import-mapping';
	import { libraryState, upsertRecord } from '$lib/library.svelte';

	const IGNORE = 'ignore';
	const PREVIEW_ROW_LIMIT = 50;

	let table = $state<CsvTable | null>(null);
	let fileName = $state('');
	let parseError = $state('');
	let draftTargets: Record<string, string> = $state({});
	let selectedMappingId = $state('');
	let unresolvedColumns: string[] = $state([]);
	let mappingName = $state('');

	const event = $derived(libraryState.library.events[page.url.searchParams.get('id') ?? '']);
	const personFields = $derived(listPersonFields(libraryState.library.customFields));
	const participantFields = $derived(
		event === undefined ? [] : listParticipantFields(libraryState.library.customFields, event.id)
	);
	const savedMappings = $derived(listImportMappingsByName(libraryState.library.importMappings));
	const mappableColumns = $derived(
		table === null ? [] : table.columns.filter((column) => column !== '')
	);
	const identityCount = $derived(
		Object.values(draftTargets).filter((encoded) => encoded === 'identity').length
	);
	const mappingNameTaken = $derived(
		isImportMappingNameDefined(libraryState.library.importMappings, mappingName)
	);
	const saveInvalid = $derived(
		table === null || mappingName.trim() === '' || mappingNameTaken || identityCount !== 1
	);
	const selectedMapping = $derived(libraryState.library.importMappings[selectedMappingId]);
	const missingColumns = $derived(
		selectedMapping === undefined || table === null
			? []
			: missingMappedColumns(selectedMapping, table.columns)
	);
	const previewRows = $derived(table === null ? [] : table.rows.slice(0, PREVIEW_ROW_LIMIT));

	function encodeTarget(target: ColumnTarget): string {
		switch (target.kind) {
			case 'identity':
				return 'identity';
			case 'role':
				return 'role';
			case 'personField':
				return `person:${target.definitionId}`;
			case 'participantField':
				return `participant:${target.fieldName}`;
		}
	}

	function decodeTarget(encoded: string): ColumnTarget | undefined {
		if (encoded === 'identity') {
			return { kind: 'identity' };
		}
		if (encoded === 'role') {
			return { kind: 'role' };
		}
		if (encoded.startsWith('person:')) {
			return { kind: 'personField', definitionId: encoded.slice('person:'.length) };
		}
		if (encoded.startsWith('participant:')) {
			return { kind: 'participantField', fieldName: encoded.slice('participant:'.length) };
		}
		return undefined;
	}

	function targetLabel(column: string): string {
		const encoded = draftTargets[column];
		if (encoded === undefined || encoded === IGNORE) {
			return 'wird ignoriert';
		}
		if (encoded === 'identity') {
			return 'Person-Identität';
		}
		if (encoded === 'role') {
			return 'Rolle';
		}
		if (encoded.startsWith('person:')) {
			const definition = libraryState.library.customFields[encoded.slice('person:'.length)];
			return `Person-Feld: ${definition?.name ?? '?'}`;
		}
		return `Teilnehmer-Feld: ${encoded.slice('participant:'.length)}`;
	}

	function isIgnored(column: string): boolean {
		const encoded = draftTargets[column];
		return encoded === undefined || encoded === IGNORE;
	}

	async function loadFile(input: HTMLInputElement) {
		const file = input.files?.[0];
		if (file === undefined) {
			return;
		}
		parseError = '';
		selectedMappingId = '';
		unresolvedColumns = [];
		try {
			table = parseCsv(await file.text());
			fileName = file.name;
			draftTargets = Object.fromEntries(
				table.columns.filter((column) => column !== '').map((column) => [column, IGNORE])
			);
		} catch (error) {
			table = null;
			fileName = file.name;
			draftTargets = {};
			parseError = error instanceof Error ? error.message : String(error);
		}
	}

	// A saved Mapping can point at targets this Library or Event no longer has
	// (removed Person-level definition, Participant-level field name not
	// defined in this Event); those columns fall back to being ignored.
	function isResolvable(target: ColumnTarget): boolean {
		if (target.kind === 'personField') {
			return libraryState.library.customFields[target.definitionId]?.level === 'person';
		}
		if (target.kind === 'participantField') {
			return participantFields.some((field) => field.name === target.fieldName);
		}
		return true;
	}

	function applySelectedMapping() {
		const applied = libraryState.library.importMappings[selectedMappingId];
		if (applied === undefined || table === null) {
			return;
		}
		const skipped: string[] = [];
		const targets: Record<string, string> = {};
		for (const column of mappableColumns) {
			const target = applied.columns[column];
			if (target === undefined) {
				targets[column] = IGNORE;
			} else if (isResolvable(target)) {
				targets[column] = encodeTarget(target);
			} else {
				targets[column] = IGNORE;
				skipped.push(column);
			}
		}
		draftTargets = targets;
		unresolvedColumns = skipped;
	}

	async function saveMapping(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (saveInvalid) {
			return;
		}
		const columns: Record<string, ColumnTarget> = {};
		for (const [column, encoded] of Object.entries(draftTargets)) {
			const target = decodeTarget(encoded);
			if (target !== undefined) {
				columns[column] = target;
			}
		}
		const mapping = defineImportMapping(libraryState.library.importMappings, mappingName, columns);
		await upsertRecord('importMappings', mapping);
		selectedMappingId = mapping.id;
		mappingName = '';
	}
</script>

{#if libraryState.status === 'loading'}
	<p>Bibliothek wird geladen …</p>
{:else if libraryState.status === 'error'}
	<p>Bibliothek konnte nicht geladen werden.</p>
{:else if event === undefined}
	<p>Veranstaltung nicht gefunden.</p>
	<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>
{:else}
	<section>
		<h2>Import — {event.name}</h2>
		<p><a href="{resolve('/event')}?id={event.id}">Zurück zur Veranstaltung</a></p>
		<p>
			Vorschau der Import-Zuordnung: es werden noch keine Personen oder Teilnehmer angelegt.
		</p>

		<label>
			CSV-Datei
			<input type="file" accept=".csv,text/csv" onchange={(e) => loadFile(e.currentTarget)} />
		</label>
		{#if parseError !== ''}
			<p>Datei „{fileName}“ kann nicht gelesen werden: {parseError}</p>
		{/if}

		{#if table !== null}
			<h3>Import-Zuordnung</h3>

			{#if savedMappings.length > 0}
				<label>
					Gespeicherte Import-Zuordnung
					<select bind:value={selectedMappingId} onchange={applySelectedMapping}>
						<option value="" disabled>Import-Zuordnung wählen …</option>
						{#each savedMappings as mapping (mapping.id)}
							<option value={mapping.id}>{mapping.name}</option>
						{/each}
					</select>
				</label>
				{#if missingColumns.length > 0}
					<p>Spalten dieser Import-Zuordnung fehlen in der Datei: {missingColumns.join(', ')}</p>
				{/if}
				{#if unresolvedColumns.length > 0}
					<p>
						Zuordnungsziele nicht mehr vorhanden, Spalten werden ignoriert:
						{unresolvedColumns.join(', ')}
					</p>
				{/if}
			{/if}

			<ul>
				{#each mappableColumns as column (column)}
					<li>
						<label>
							{column}
							<select bind:value={draftTargets[column]}>
								<option value={IGNORE}>Ignorieren</option>
								<option value="identity">Person-Identität (Name)</option>
								{#each personFields as field (field.id)}
									<option value="person:{field.id}">Person-Feld: {field.name}</option>
								{/each}
								{#each participantFields as field (field.id)}
									<option value="participant:{field.name}">Teilnehmer-Feld: {field.name}</option>
								{/each}
								<option value="role">Rolle</option>
							</select>
						</label>
					</li>
				{/each}
			</ul>
			{#if identityCount === 0}
				<p>Genau eine Spalte muss die Person-Identität (Name) sein.</p>
			{:else if identityCount > 1}
				<p>Nur eine Spalte darf die Person-Identität sein.</p>
			{/if}

			<form onsubmit={saveMapping}>
				<label>
					Als Import-Zuordnung speichern
					<input type="text" bind:value={mappingName} placeholder="Name der Import-Zuordnung" />
				</label>
				<button type="submit" disabled={saveInvalid}>Speichern</button>
				{#if mappingNameTaken}
					<span>Name bereits vergeben.</span>
				{/if}
			</form>

			<h3>Vorschau — {fileName}</h3>
			<table>
				<thead>
					<tr>
						{#each table.columns as column, index (index)}
							<th class:ignored={column === '' || isIgnored(column)}>
								{column === '' ? '(ohne Namen)' : column}
								<br />
								<small>{column === '' ? 'wird ignoriert' : targetLabel(column)}</small>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each previewRows as row, rowIndex (rowIndex)}
						<tr>
							{#each table.columns as column, index (index)}
								<td class:ignored={column === '' || isIgnored(column)}>{row[index] ?? ''}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
			{#if table.rows.length > PREVIEW_ROW_LIMIT}
				<p>… und {table.rows.length - PREVIEW_ROW_LIMIT} weitere Zeilen.</p>
			{/if}
		{/if}
	</section>
{/if}

<style>
	table {
		border-collapse: collapse;
	}

	th,
	td {
		border: 1px solid currentColor;
		padding: 0.25rem 0.5rem;
		text-align: left;
		vertical-align: top;
	}

	.ignored {
		opacity: 0.45;
	}
</style>
