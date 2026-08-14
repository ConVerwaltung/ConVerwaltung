<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { parseCsv, type CsvTable } from '$lib/domain/csv';
	import { listParticipantFields, listPersonFields } from '$lib/domain/custom-field';
	import { planImport, type ImportPlan } from '$lib/domain/import';
	import {
		proposeMatches,
		undecidedRowNumbers,
		type ImportDecision,
		type RowMatch
	} from '$lib/domain/import-match';
	import {
		defineImportMapping,
		isImportMappingNameDefined,
		listImportMappingsByName,
		missingMappedColumns,
		shapeRows,
		type ColumnTarget,
		type ShapedRow
	} from '$lib/domain/import-mapping';
	import { noteOf } from '$lib/domain/note';
	import type { Person } from '$lib/domain/person';
	import type { RecordPut } from '$lib/domain/library';
	import { commitBatch, libraryState, upsertRecord } from '$lib/library.svelte';

	const IGNORE = 'ignore';
	const PREVIEW_ROW_LIMIT = 50;
	const NEW_PERSON = 'new';
	const LINK_PREFIX = 'link:';
	const NOTE_EXCERPT_LENGTH = 80;

	let table = $state<CsvTable | null>(null);
	let fileName = $state('');
	let parseError = $state('');
	let draftTargets: Record<string, string> = $state({});
	let selectedMappingId = $state('');
	let unresolvedColumns: string[] = $state([]);
	let mappingName = $state('');
	let matches = $state<RowMatch[] | null>(null);
	let shapedRows: ShapedRow[] = $state([]);
	let choices: Record<number, string> = $state({});
	let importResult = $state<ImportPlan | null>(null);
	let importing = $state(false);

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
		table === null || mappingName.trim() === '' || mappingNameTaken || identityCount === 0
	);
	const selectedMapping = $derived(libraryState.library.importMappings[selectedMappingId]);
	const missingColumns = $derived(
		selectedMapping === undefined || table === null
			? []
			: missingMappedColumns(selectedMapping, table.columns)
	);
	const previewRows = $derived(table === null ? [] : table.rows.slice(0, PREVIEW_ROW_LIMIT));
	const draftColumns = $derived(decodeTargets(draftTargets));
	const decisions = $derived(decodeDecisions(choices));
	const undecidedRows = $derived(matches === null ? [] : undecidedRowNumbers(matches, decisions));
	const importDisabled = $derived(
		matches === null || undecidedRows.length > 0 || importResult !== null || importing
	);

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

	function decodeTargets(targets: Record<string, string>): Record<string, ColumnTarget> {
		const columns: Record<string, ColumnTarget> = {};
		for (const [column, encoded] of Object.entries(targets)) {
			const target = decodeTarget(encoded);
			if (target !== undefined) {
				columns[column] = target;
			}
		}
		return columns;
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

	function decodeDecisions(chosen: Record<number, string>): ReadonlyMap<number, ImportDecision> {
		// A plain value rebuilt by $derived whenever `choices` changes, not reactive state:
		// the domain takes a ReadonlyMap and never mutates it.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const decided = new Map<number, ImportDecision>();
		for (const [rowNumber, choice] of Object.entries(chosen)) {
			if (choice === NEW_PERSON) {
				decided.set(Number(rowNumber), { kind: 'new' });
			} else if (choice.startsWith(LINK_PREFIX)) {
				const personId = choice.slice(LINK_PREFIX.length);
				decided.set(Number(rowNumber), { kind: 'link', personId });
			}
		}
		return decided;
	}

	function eventNamesOf(personId: string): string {
		const names = Object.values(libraryState.library.participants)
			.filter((participant) => participant.person === personId)
			.map((participant) => libraryState.library.events[participant.event]?.name)
			.filter((name) => name !== undefined);
		return names.length === 0 ? 'bisher in keiner Veranstaltung' : names.join(', ');
	}

	function noteExcerpt(person: Person): string {
		const note = noteOf(person).replace(/\s+/g, ' ').trim();
		return note.length <= NOTE_EXCERPT_LENGTH ? note : `${note.slice(0, NOTE_EXCERPT_LENGTH)}…`;
	}

	function similarityPercent(similarity: number): number {
		return Math.round(similarity * 100);
	}

	// The proposals rest on the mapped columns, so any change to them invalidates
	// the review the organizer has done so far.
	function resetMatching() {
		matches = null;
		shapedRows = [];
		choices = {};
		importResult = null;
	}

	function prepareMatching() {
		if (table === null || identityCount === 0) {
			return;
		}
		const rows = shapeRows(table, draftColumns);
		const proposals = proposeMatches(libraryState.library.persons, rows);
		const initialChoices = proposals.map((match): [number, string] => {
			const choice = match.candidates.length === 0 ? NEW_PERSON : '';
			return [match.rowNumber, choice];
		});
		shapedRows = rows;
		matches = proposals;
		choices = Object.fromEntries(initialChoices);
		importResult = null;
	}

	async function loadFile(input: HTMLInputElement) {
		const file = input.files?.[0];
		if (file === undefined) {
			return;
		}
		parseError = '';
		selectedMappingId = '';
		unresolvedColumns = [];
		resetMatching();
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
		resetMatching();
	}

	async function saveMapping(submitEvent: SubmitEvent) {
		submitEvent.preventDefault();
		if (saveInvalid) {
			return;
		}
		const mapping = defineImportMapping(
			libraryState.library.importMappings,
			mappingName,
			draftColumns
		);
		await upsertRecord('importMappings', mapping);
		selectedMappingId = mapping.id;
		mappingName = '';
	}

	async function runImport() {
		if (importDisabled) {
			return;
		}
		importing = true;
		const plan = planImport(libraryState.library, event.id, shapedRows, decisions);
		const personPuts: RecordPut[] = [...plan.newPersons, ...plan.linkedPersons].map((person) => ({
			section: 'persons',
			record: person
		}));
		const participantPuts: RecordPut[] = [
			...plan.newParticipants,
			...plan.updatedParticipants
		].map((participant) => ({ section: 'participants', record: participant }));
		await commitBatch({ puts: [...personPuts, ...participantPuts] });
		importResult = plan;
		importing = false;
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
			CSV-Datei wählen, Spalten zuordnen, Vorschau prüfen und den Import ausführen.
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
							<select bind:value={draftTargets[column]} onchange={resetMatching}>
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
				<p>Mindestens eine Spalte muss die Person-Identität (Name) sein.</p>
			{:else if identityCount > 1}
				<p>Der Name wird aus {identityCount} Spalten in Dateireihenfolge zusammengesetzt.</p>
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
						<th>Zeile</th>
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
							<td>{rowIndex + 1}</td>
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

			<h3>Abgleich</h3>
			<p>
				Jede Zeile wird mit dem Personen-Pool verglichen und ähnliche Namen werden als Vorschläge
				angeboten. Ob eine Zeile zu einer bestehenden Person gehört oder eine neue anlegt, wird pro
				Zeile entschieden — automatisch übernommen wird kein Vorschlag.
			</p>
			{#if matches === null}
				<button type="button" onclick={prepareMatching} disabled={identityCount !== 1}>
					Abgleich vorbereiten
				</button>
			{:else}
				{#if matches.length === 0}
					<p>Keine Zeile mit Namen — es gibt nichts abzugleichen.</p>
				{/if}
				<ol class="review">
					{#each matches as match (match.rowNumber)}
						<li>
							<p>Zeile {match.rowNumber}: <strong>{match.personName}</strong></p>
							{#if match.candidates.length === 0}
								<p>Keine ähnliche Person im Pool.</p>
							{/if}
							<label>
								<input
									type="radio"
									name="decision-{match.rowNumber}"
									value={NEW_PERSON}
									bind:group={choices[match.rowNumber]}
								/>
								Neue Person anlegen
							</label>
							{#each match.candidates as candidate (candidate.person.id)}
								<label>
									<input
										type="radio"
										name="decision-{match.rowNumber}"
										value="{LINK_PREFIX}{candidate.person.id}"
										bind:group={choices[match.rowNumber]}
									/>
									{candidate.person.name} — {similarityPercent(candidate.similarity)} % Ähnlichkeit
									<small>
										{eventNamesOf(candidate.person.id)}{#if noteExcerpt(candidate.person) !== ''}
											&nbsp;— Notiz: „{noteExcerpt(candidate.person)}“
										{/if}
									</small>
								</label>
							{/each}
						</li>
					{/each}
				</ol>
				{#if undecidedRows.length > 0}
					<p>Noch offen — Zeilen: {undecidedRows.join(', ')}</p>
				{/if}
			{/if}

			<h3>Import ausführen</h3>
			<p>
				Verknüpfte Zeilen schreiben ihre zugeordneten Werte in die bestehende Person und legen einen
				Teilnehmer in „{event.name}“ an; nimmt die Person dort bereits teil, wird dieser Teilnehmer
				aktualisiert. Alle übrigen Zeilen legen eine neue Person an.
			</p>
			<p>
				Rollennamen, die diese Veranstaltung nicht als Rolle definiert hat, werden nicht zugewiesen,
				sondern im Ergebnis gemeldet. Zeilen ohne Namen werden übersprungen.
			</p>
			<button type="button" onclick={runImport} disabled={importDisabled}>
				{table.rows.length} Zeilen importieren
			</button>

			{#if importResult !== null}
				<h4>Ergebnis</h4>
				<p>
					{importResult.newPersons.length} Personen neu angelegt,
					{importResult.linkedPersons.length} bestehende Personen verknüpft,
					{importResult.newParticipants.length} Teilnehmer angelegt,
					{importResult.updatedParticipants.length} Teilnehmer aktualisiert,
					{importResult.skippedRowNumbers.length + importResult.unnamedRowNumbers.length} Zeilen
					übersprungen.
				</p>
				{#if importResult.unnamedRowNumbers.length > 0}
					<p>Ohne Namen, daher übersprungen — Zeilen: {importResult.unnamedRowNumbers.join(', ')}</p>
				{/if}
				{#if importResult.unknownRoleNames.length > 0}
					<p>
						In dieser Veranstaltung nicht definiert, daher nicht zugewiesen — Rollen:
						{importResult.unknownRoleNames.join(', ')}
					</p>
				{/if}
				{#if importResult.rejectedValues.length > 0}
					<p>Passt nicht zum Feldtyp, daher nicht übernommen:</p>
					<ul>
						{#each importResult.rejectedValues as rejected, index (index)}
							<li>Zeile {rejected.rowNumber}, {rejected.fieldName}: „{rejected.value}“</li>
						{/each}
					</ul>
				{/if}
				<p>Für einen weiteren Import eine Datei wählen.</p>
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

	.review li {
		margin-bottom: 0.75rem;
	}

	.review label {
		display: block;
	}

	.review small {
		display: block;
		margin-left: 1.5rem;
		opacity: 0.75;
	}
</style>
