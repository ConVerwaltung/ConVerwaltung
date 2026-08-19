<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Blatt from '$lib/components/Blatt.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Register from '$lib/components/Register.svelte';
	import { CsvParseError, parseCsv, type CsvTable } from '$lib/domain/csv';
	import {
		customValueOf,
		listParticipantFields,
		listPersonFields
	} from '$lib/domain/custom-field';
	import { planImport, type ImportPlan } from '$lib/domain/import';
	import { proposeMatches, type ImportDecision, type RowMatch } from '$lib/domain/import-match';
	import {
		defineImportMapping,
		identityChainOf,
		identityColumnsOf,
		isImportMappingNameDefined,
		listImportMappingsByName,
		missingMappedColumns,
		remapImportMapping,
		type ColumnTarget,
		type ImportMapping,
		shapeRows
	} from '$lib/domain/import-mapping';
	import {
		bestSimilarity,
		countRowsByRoleName,
		filterWords,
		gradeMatch,
		gradeWords,
		matchesReviewFilter,
		namePartsAgainst,
		namesakeCount,
		namesakeIndex,
		noProvenance,
		provenanceIndex,
		reviewFilters,
		safeLinks,
		tallyDecisions,
		unmatchedRowNumbers,
		type ReviewFilter
	} from '$lib/domain/import-review';
	import type { RecordPut } from '$lib/domain/library';
	import { noteOf } from '$lib/domain/note';
	import type { Participant } from '$lib/domain/participant';
	import { listPersonsByName, type Person } from '$lib/domain/person';
	import { listRoles } from '$lib/domain/role';
	import { closeEditor, isEditorOpen, openEditor } from '$lib/editor.svelte';
	import { markUncommittedWork, reportFileError } from '$lib/frame.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import { commitBatch, libraryState, upsertRecord } from '$lib/library.svelte';

	// The answer the organizer gave a row. The absence of an entry is `Offen` — which is
	// why there is no fourth value here: an open row stores nothing at all (ADR-0004 gap 2).
	type Answer = 'neu' | 'link' | 'skip';

	interface ReviewRow {
		readonly rowNumber: number;
		/** Null before a column names the Person — the file is shown, the review is not. */
		readonly match: RowMatch | null;
	}

	interface FileColumn {
		readonly name: string;
		readonly index: number;
	}

	interface ValueComparison {
		readonly label: string;
		readonly fileValue: string;
		readonly storedValue: string;
	}

	const IGNORE = 'ignore';
	// Before a name column is chosen there is nothing to review, so the register shows the
	// file itself — enough rows to judge a mapping by, not the whole file twice.
	const UNMAPPED_PREVIEW = 20;
	const SEARCH_LIMIT = 8;
	const NOTE_EXCERPT_LENGTH = 80;

	let table = $state<CsvTable | null>(null);
	let fileName = $state('');
	// The one sentence that stops the review from existing: an unreadable file, or a
	// Zuordnung whose identity columns this file does not have. Mirrored into the frame.
	let fileProblem = $state<string | null>(null);
	let draftTargets = $state<Record<string, string>>({});
	let selectedMappingId = $state('');
	let unresolvedColumns = $state<string[]>([]);
	let showAllColumns = $state(false);
	let filter = $state<ReviewFilter>('alle');
	let query = $state('');
	let answers = $state<Record<number, Answer>>({});
	let boundPersons = $state<Record<number, string>>({});
	let personQuery = $state('');
	let namingMapping = $state(false);
	let mappingName = $state('');
	let mappingNameProblem = $state('');
	let importing = $state(false);
	let report = $state<ImportPlan | null>(null);

	let fileField = $state<HTMLInputElement | null>(null);
	let mappingNameField = $state<HTMLInputElement | null>(null);

	const event = $derived(libraryState.library.events[page.params.id ?? '']);
	const pageTitle = $derived(
		event === undefined ? 'Veranstaltung nicht gefunden – AMTS' : `Import – ${event.name} – AMTS`
	);

	const personFields = $derived(listPersonFields(libraryState.library.customFields));
	const participantFields = $derived(
		event === undefined ? [] : listParticipantFields(libraryState.library.customFields, event.id)
	);
	const roles = $derived(event === undefined ? [] : listRoles(libraryState.library.roles, event.id));
	const savedMappings = $derived(listImportMappingsByName(libraryState.library.importMappings));
	const selectedMapping = $derived(libraryState.library.importMappings[selectedMappingId]);

	const mappableColumns = $derived(
		table === null ? [] : table.columns.filter((column) => column !== '')
	);
	const draftColumns = $derived(decodeTargets(draftTargets));
	const identityChain = $derived(
		table === null ? [] : identityChainOf(draftColumns, table.columns)
	);
	const mapped = $derived(identityChain.length > 0);
	const missingColumns = $derived(
		selectedMapping === undefined || table === null
			? []
			: missingMappedColumns(selectedMapping, table.columns)
	);

	const fileColumns = $derived(
		table === null ? [] : table.columns.map((name, index) => ({ name, index }))
	);
	const shownColumns = $derived(fileColumns.filter(isShownColumn));
	const columnCount = $derived(shownColumns.length + 7);

	const shaped = $derived(table === null || !mapped ? [] : shapeRows(table, draftColumns));
	const matches = $derived(proposeMatches(libraryState.library.persons, shaped));
	const decisions = $derived(collectDecisions(matches));
	const namesakes = $derived(namesakeIndex(libraryState.library.persons));
	const provenance = $derived(
		provenanceIndex(libraryState.library.participants, libraryState.library.events)
	);

	const rows = $derived(mapped ? reviewRows() : previewRows());
	const tally = $derived(tallyDecisions(matches, decisions));
	const safeRows = $derived(safeLinks(matches, decisions));
	const unmatched = $derived(unmatchedRowNumbers(matches, decisions));
	const unnamedRows = $derived(shaped.filter((row) => row.personName === '').length);
	const participantsHere = $derived(
		event === undefined
			? []
			: Object.values(libraryState.library.participants).filter(
					(participant) => participant.event === event.id
				)
	);

	// The flag the frame's reload confirm reads: this screen is its only setter, because the
	// parsed file, the mapping draft and every decision live here and the File cannot be
	// read again after a reload.
	$effect(() => {
		markUncommittedWork(lossSentence());
		return () => markUncommittedWork(null);
	});

	// The banner belongs to the app frame, the sentence to this screen; leaving takes it.
	$effect(() => {
		reportFileError(fileProblem);
	});

	onDestroy(() => reportFileError(null));

	function lossSentence(): string | null {
		if (table === null || report !== null) {
			return null;
		}
		const decided = tally.neu + tally.verknuepft + tally.uebersprungen;
		if (decided > 0) {
			return `${decided} entschiedene Zeilen der Import-Prüfung gehen verloren.`;
		}
		return `Die geladene Datei „${fileName}“ muss neu gewählt werden.`;
	}

	/* The Zuordnung — encoded per column, because a <select> carries a string. */

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

	function isIgnored(column: string): boolean {
		const encoded = draftTargets[column];
		return encoded === undefined || encoded === IGNORE;
	}

	// The identity columns are folded into `Name in der Datei`, whose head carries their
	// selects — otherwise Vorname and Nachname stand in every row twice.
	function isShownColumn(column: FileColumn): boolean {
		if (!mapped) {
			return true;
		}
		if (column.name === '') {
			return showAllColumns;
		}
		if (draftTargets[column.name] === 'identity') {
			return false;
		}
		return showAllColumns || !isIgnored(column.name);
	}

	function chainWords(): string {
		return identityChain.length === 0
			? 'noch keine Spalte'
			: `aus ${identityChain.join(' + ')}`;
	}

	// The proposals rest on the name, so retargeting an identity column invalidates every
	// decision made against them. Mapping a value column leaves the review standing.
	function setTarget(column: string, encoded: string): void {
		const touchesIdentity = draftTargets[column] === 'identity' || encoded === 'identity';
		draftTargets[column] = encoded;
		if (touchesIdentity) {
			resetReview();
		}
	}

	function resetReview(): void {
		answers = {};
		boundPersons = {};
		report = null;
	}

	/* The file. */

	function listWords(words: readonly string[]): string {
		return words.map((word) => `„${word}“`).join(' und ');
	}

	function parseFailureSentence(error: unknown, name: string): string {
		if (!(error instanceof CsvParseError)) {
			return `Datei „${name}“ kann nicht gelesen werden — ${String(error)}.`;
		}
		if (error.reason === 'empty') {
			return `Datei „${name}“ enthält keine Zeilen — eine Datei mit einer Kopfzeile wählen.`;
		}
		if (error.reason === 'duplicateColumn') {
			return `Datei „${name}“ führt die Spalte „${error.column}“ zweimal — die Spaltennamen in der Kopfzeile eindeutig machen und die Datei erneut wählen.`;
		}
		const where = error.line === undefined ? '' : ` in Zeile ${error.line}`;
		return `Datei „${name}“ kann nicht gelesen werden: ein Anführungszeichen ist${where} nicht geschlossen — die Zeile in der Datei schließen und erneut wählen.`;
	}

	async function loadFile(input: HTMLInputElement): Promise<void> {
		const file = input.files?.[0];
		if (file === undefined) {
			return;
		}
		selectedMappingId = '';
		unresolvedColumns = [];
		showAllColumns = false;
		filter = 'alle';
		query = '';
		namingMapping = false;
		resetReview();
		fileName = file.name;
		try {
			const parsed = parseCsv(await file.text());
			table = parsed;
			draftTargets = Object.fromEntries(
				parsed.columns.filter((column) => column !== '').map((column) => [column, IGNORE])
			);
			fileProblem = null;
		} catch (error) {
			table = null;
			draftTargets = {};
			fileProblem = parseFailureSentence(error, file.name);
		}
	}

	async function startOver(): Promise<void> {
		table = null;
		fileName = '';
		fileProblem = null;
		draftTargets = {};
		selectedMappingId = '';
		unresolvedColumns = [];
		resetReview();
		await tick();
		fileField?.focus();
	}

	/* A saved Zuordnung, applied to this file. */

	// A saved Zuordnung can point at targets this Library or Veranstaltung no longer has;
	// those columns fall back to being ignored and are named as an advisory.
	function isResolvable(target: ColumnTarget): boolean {
		if (target.kind === 'personField') {
			return libraryState.library.customFields[target.definitionId]?.level === 'person';
		}
		if (target.kind === 'participantField') {
			return participantFields.some((field) => field.name === target.fieldName);
		}
		return true;
	}

	function targetsOf(applied: ImportMapping): {
		targets: Record<string, string>;
		skipped: string[];
	} {
		const targets: Record<string, string> = {};
		const skipped: string[] = [];
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
		return { targets, skipped };
	}

	// A Zuordnung whose identity columns the file lacks cannot name a single Person, so the
	// review does not pretend to exist — the banner names the columns it expected.
	function identityGapSentence(applied: ImportMapping): string | null {
		const expected = identityColumnsOf(applied.columns);
		const present = expected.filter((column) => mappableColumns.includes(column));
		if (present.length > 0) {
			return null;
		}
		return `Die Zuordnung „${applied.name}“ erwartet den Namen in ${listWords(expected)} — diese Spalten hat die Datei „${fileName}“ nicht. Eine andere Zuordnung wählen oder die Spalten von Hand zuordnen.`;
	}

	function applySelectedMapping(): void {
		resetReview();
		unresolvedColumns = [];
		const applied = libraryState.library.importMappings[selectedMappingId];
		if (applied === undefined) {
			draftTargets = Object.fromEntries(mappableColumns.map((column) => [column, IGNORE]));
			fileProblem = null;
			return;
		}
		const { targets, skipped } = targetsOf(applied);
		draftTargets = targets;
		unresolvedColumns = skipped;
		fileProblem = identityGapSentence(applied);
	}

	async function saveBackToMapping(): Promise<void> {
		if (selectedMapping === undefined) {
			return;
		}
		await upsertRecord('importMappings', remapImportMapping(selectedMapping, draftColumns));
	}

	async function startNamingMapping(): Promise<void> {
		namingMapping = true;
		mappingName = '';
		mappingNameProblem = '';
		await tick();
		mappingNameField?.focus();
	}

	function stopNamingMapping(): void {
		namingMapping = false;
		mappingName = '';
		mappingNameProblem = '';
	}

	async function saveNewMapping(submit: SubmitEvent): Promise<void> {
		submit.preventDefault();
		const name = mappingName.trim();
		if (name === '') {
			mappingNameProblem = 'Ein Name ist nötig.';
			mappingNameField?.focus();
			return;
		}
		if (isImportMappingNameDefined(libraryState.library.importMappings, name)) {
			mappingNameProblem = 'Name bereits vergeben.';
			mappingNameField?.focus();
			return;
		}
		const mapping = defineImportMapping(
			libraryState.library.importMappings,
			name,
			draftColumns
		);
		await upsertRecord('importMappings', mapping);
		if (libraryState.writeFailure !== null) {
			return;
		}
		selectedMappingId = mapping.id;
		stopNamingMapping();
	}

	/* The review. */

	function boundPersonId(match: RowMatch): string {
		return boundPersons[match.rowNumber] ?? match.candidates[0]?.person.id ?? '';
	}

	function boundPerson(match: RowMatch): Person | undefined {
		return libraryState.library.persons[boundPersonId(match)];
	}

	function boundPersonName(match: RowMatch): string {
		return boundPerson(match)?.name ?? '';
	}

	function collectDecisions(reviewed: readonly RowMatch[]): ReadonlyMap<number, ImportDecision> {
		// A plain value rebuilt by $derived whenever an answer changes, not reactive state:
		// the domain takes a ReadonlyMap and never mutates it.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const decided = new Map<number, ImportDecision>();
		for (const match of reviewed) {
			const given = answers[match.rowNumber];
			const personId = boundPersonId(match);
			if (given === 'neu') {
				decided.set(match.rowNumber, { kind: 'new' });
			} else if (given === 'skip') {
				decided.set(match.rowNumber, { kind: 'skip' });
			} else if (given === 'link' && personId !== '') {
				decided.set(match.rowNumber, { kind: 'link', personId });
			}
		}
		return decided;
	}

	function answerOf(rowNumber: number): Answer | 'offen' {
		return answers[rowNumber] ?? 'offen';
	}

	// Radios cannot be unselected, so un-deciding needs an option of its own: choosing
	// `Offen` removes the entry, and the absence is the open state the counter reads.
	function answer(rowNumber: number, chosen: Answer | 'offen'): void {
		if (chosen === 'offen') {
			delete answers[rowNumber];
			return;
		}
		answers[rowNumber] = chosen;
	}

	function bindPerson(rowNumber: number, personId: string): void {
		boundPersons[rowNumber] = personId;
	}

	function isShownRow(match: RowMatch): boolean {
		const grade = gradeMatch(match);
		if (!matchesReviewFilter(filter, match, grade, decisions.get(match.rowNumber))) {
			return false;
		}
		const needle = query.trim().toLowerCase();
		if (needle === '') {
			return true;
		}
		const proposal = boundPersonName(match).toLowerCase();
		return match.personName.toLowerCase().includes(needle) || proposal.includes(needle);
	}

	function reviewRows(): ReviewRow[] {
		return matches
			.filter(isShownRow)
			.map((match) => ({ rowNumber: match.rowNumber, match }));
	}

	function previewRows(): ReviewRow[] {
		const shownRows = table === null ? [] : table.rows.slice(0, UNMAPPED_PREVIEW);
		return shownRows.map((_row, index) => ({ rowNumber: index + 1, match: null }));
	}

	function filterCount(candidateFilter: ReviewFilter): number {
		return matches.filter((match) =>
			matchesReviewFilter(
				candidateFilter,
				match,
				gradeMatch(match),
				decisions.get(match.rowNumber)
			)
		).length;
	}

	function filterDescription(): string {
		const parts = [filterWords[filter]];
		if (query.trim() !== '') {
			parts.push(`„${query.trim()}“`);
		}
		return parts.join(' · ');
	}

	function resetFilters(): void {
		filter = 'alle';
		query = '';
	}

	function cellValue(rowNumber: number, index: number): string {
		return table?.rows[rowNumber - 1]?.[index] ?? '';
	}

	function percent(similarity: number): number {
		return Math.round(similarity * 100);
	}

	/* The evidence. */

	interface Beleg {
		readonly text: string;
		/** The exception the Beleg column prefers — a duplicate row or a namesake. */
		readonly exception: boolean;
		readonly note: boolean;
	}

	function provenanceWords(personId: string): string {
		const found = provenance.get(personId) ?? noProvenance;
		if (found.eventCount === 0) {
			return 'ohne Veranstaltung';
		}
		const count =
			found.eventCount === 1 ? '1 Veranstaltung' : `${found.eventCount} Veranstaltungen`;
		return `${count} · zuletzt ${found.lastEventName}`;
	}

	function belegOf(match: RowMatch): Beleg {
		const person = boundPerson(match);
		const note = person !== undefined && noteOf(person) !== '';
		if (match.duplicateOfRowNumber !== undefined) {
			return {
				text: `Derselbe Name steht schon in Zeile ${match.duplicateOfRowNumber}`,
				exception: true,
				note
			};
		}
		const alike = namesakeCount(namesakes, match.personName);
		if (alike > 1) {
			return { text: `${alike} gleichnamige Personen`, exception: true, note };
		}
		if (person === undefined) {
			return { text: 'Keine ähnliche Person im Pool', exception: false, note };
		}
		return { text: provenanceWords(person.id), exception: false, note };
	}

	function noteExcerpt(person: Person): string {
		const note = noteOf(person).replace(/\s+/g, ' ').trim();
		return note.length <= NOTE_EXCERPT_LENGTH ? note : `${note.slice(0, NOTE_EXCERPT_LENGTH)}…`;
	}

	function personFieldWords(person: Person): string {
		return personFields
			.map((field) => ({ name: field.name, value: customValueOf(person, field.id) }))
			.filter((entry) => entry.value !== '')
			.map((entry) => `${entry.name}: ${entry.value}`)
			.join(' · ');
	}

	// The candidates plus the Person the organizer found by search, so a choice made from
	// the search field stays visible after the query is cleared.
	function detailPersons(match: RowMatch): Person[] {
		const proposed = match.candidates.map((candidate) => candidate.person);
		const bound = boundPerson(match);
		if (bound === undefined || proposed.some((person) => person.id === bound.id)) {
			return proposed;
		}
		return [...proposed, bound];
	}

	function similarityOf(match: RowMatch, personId: string): number | undefined {
		return match.candidates.find((candidate) => candidate.person.id === personId)?.similarity;
	}

	// The 11 rows in a real file the matcher proposes nothing for are people the Library
	// already knows — the search is how they are found.
	function searchHits(match: RowMatch): Person[] {
		const needle = personQuery.trim().toLowerCase();
		if (needle === '') {
			return [];
		}
		const shownIds = new Set(detailPersons(match).map((person) => person.id));
		return listPersonsByName(libraryState.library.persons)
			.filter((person) => !shownIds.has(person.id))
			.filter((person) => person.name.toLowerCase().includes(needle))
			.slice(0, SEARCH_LIMIT);
	}

	function participantOf(personId: string): Participant | undefined {
		return participantsHere.find((participant) => participant.person === personId);
	}

	function roleNamesOf(participant: Participant): string[] {
		return participant.roles
			.map((roleId) => roles.find((role) => role.id === roleId)?.name)
			.filter((name) => name !== undefined);
	}

	// What this row would write, against what the bound Person already has — the file's
	// values and the stored ones side by side, which is the other half of the evidence.
	function comparisons(match: RowMatch): ValueComparison[] {
		const row = shaped[match.rowNumber - 1];
		const person = boundPerson(match);
		const participant = person === undefined ? undefined : participantOf(person.id);
		const list: ValueComparison[] = [];
		for (const [definitionId, value] of Object.entries(row.personValues)) {
			const definition = libraryState.library.customFields[definitionId];
			if (definition === undefined) {
				continue;
			}
			list.push({
				label: definition.name,
				fileValue: value,
				storedValue: person === undefined ? '' : customValueOf(person, definitionId)
			});
		}
		for (const [fieldName, value] of Object.entries(row.participantValues)) {
			const definition = participantFields.find((field) => field.name === fieldName);
			list.push({
				label: fieldName,
				fileValue: value,
				storedValue:
					definition === undefined || participant === undefined
						? ''
						: customValueOf(participant, definition.id)
			});
		}
		if (row.roleNames.length > 0) {
			list.push({
				label: 'Rollen',
				fileValue: row.roleNames.join(', '),
				storedValue: participant === undefined ? '' : roleNamesOf(participant).join(', ')
			});
		}
		return list;
	}

	/* The detail row — the evidence, opened in place through the app's one editor state. */

	function detailEditorId(rowNumber: number): string {
		return `import-zeile-${rowNumber}`;
	}

	function isRowOpen(rowNumber: number): boolean {
		return isEditorOpen(detailEditorId(rowNumber));
	}

	function toggleDetail(rowNumber: number, trigger: HTMLElement): void {
		if (isRowOpen(rowNumber)) {
			closeEditor(detailEditorId(rowNumber));
			trigger.focus();
			return;
		}
		personQuery = '';
		openEditor({ id: detailEditorId(rowNumber), trigger });
	}

	/* The two bulk acts — Sammelaktion, never Vorauswahl. */

	function countWords(count: number, one: string, many: string): string {
		return count === 1 ? `1 ${one}` : `${count} ${many}`;
	}

	function takeSafeLinks(): void {
		for (const link of safeRows) {
			boundPersons[link.rowNumber] = link.personId;
			answers[link.rowNumber] = 'link';
		}
	}

	function createUnmatched(): void {
		for (const rowNumber of unmatched) {
			answers[rowNumber] = 'neu';
		}
	}

	/* The commit. */

	function consequenceSentence(): string {
		const parts = [
			`Legt ${countWords(tally.neu, 'Person', 'Personen')} neu an`,
			`schreibt ${countWords(tally.verknuepft, 'bestehenden Person', 'bestehenden Personen')} die Werte der Datei zu`,
			`trägt beide als Teilnehmer in „${event.name}“ ein`
		];
		return `${parts.join(', ')}. ${countWords(tally.uebersprungen, 'Zeile bleibt', 'Zeilen bleiben')} unberührt.`;
	}

	function rejectedFieldNames(): string[] {
		if (report === null) {
			return [];
		}
		return [...new Set(report.rejectedValues.map((value) => value.fieldName))];
	}

	function unknownRoles(): { name: string; rows: number }[] {
		return report === null ? [] : countRowsByRoleName(shaped, decisions, report.unknownRoleNames);
	}

	// Pressing with rows still open is not an error and the button is never disabled for it
	// (§4): the filter switches to `Offen` and shows what is missing.
	async function runImport(): Promise<void> {
		if (importing) {
			return;
		}
		if (tally.offen > 0) {
			filter = 'offen';
			query = '';
			return;
		}
		importing = true;
		const plan = planImport(libraryState.library, event.id, shaped, decisions);
		const personPuts: RecordPut[] = [...plan.newPersons, ...plan.linkedPersons].map((person) => ({
			section: 'persons',
			record: person
		}));
		const participantPuts: RecordPut[] = [...plan.newParticipants, ...plan.updatedParticipants].map(
			(participant) => ({ section: 'participants', record: participant })
		);
		await commitBatch({ puts: [...personPuts, ...participantPuts] });
		importing = false;
		if (libraryState.writeFailure !== null) {
			return;
		}
		report = plan;
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#snippet resetAction()}
	<button type="button" class="btn quiet" onclick={resetFilters}>Filter zurücksetzen</button>
{/snippet}

{#snippet nameParts(name: string, other: string)}
	<!-- The separator is an expression, not markup whitespace, which an each block trims —
	     and it sits outside the span so the wavy underline covers the word alone. -->
	{#each namePartsAgainst(name, other) as part, index (index)}{index === 0 ? '' : ' '}<span class:differs={part.differs}>{part.text}</span>{/each}
{/snippet}

{#snippet targetSelect(column: string)}
	<select
		class="target"
		value={draftTargets[column] ?? IGNORE}
		aria-label={`Ziel der Spalte „${column}“`}
		onchange={(pick) => setTarget(column, pick.currentTarget.value)}
	>
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
{/snippet}

{#snippet head()}
	<tr>
		<th scope="col" class="label zeile num">Zeile</th>
		<th scope="col" class="label name">
			Name in der Datei
			<span class="chain">{chainWords()}</span>
			<span class="selects">
				{#each identityChain as column (column)}
					{@render targetSelect(column)}
				{/each}
			</span>
		</th>
		<th scope="col" class="label">Entscheidung</th>
		<th scope="col" class="label">Ähnlichkeit</th>
		<th scope="col" class="label">Vorschlag</th>
		<th scope="col" class="label">Beleg</th>
		{#each shownColumns as column (column.index)}
			<th scope="col" class="label" class:ignored={column.name !== '' && isIgnored(column.name)}>
				{column.name === '' ? '(ohne Namen)' : column.name}
				{#if column.name !== ''}
					{@render targetSelect(column.name)}
				{:else}
					<span class="chain">ohne Spaltennamen — nicht zuordenbar</span>
				{/if}
			</th>
		{/each}
		<th scope="col" class="label"><span class="vh">Belege</span></th>
	</tr>
{/snippet}

{#snippet decisionGroup(match: RowMatch)}
	{@const chosen = answerOf(match.rowNumber)}
	{@const linkable = boundPersonId(match) !== ''}
	<fieldset class="segmented">
		<legend class="vh">Entscheidung für Zeile {match.rowNumber} · {match.personName}</legend>
		<label>
			<input
				type="radio"
				name="entscheidung-{match.rowNumber}"
				value="offen"
				checked={chosen === 'offen'}
				onchange={() => answer(match.rowNumber, 'offen')}
			/>
			<span>Offen</span>
		</label>
		<label>
			<input
				type="radio"
				name="entscheidung-{match.rowNumber}"
				value="link"
				disabled={!linkable}
				checked={chosen === 'link'}
				onchange={() => answer(match.rowNumber, 'link')}
			/>
			<span><Icon name="link" label={null} />Verknüpfen</span>
		</label>
		<label>
			<input
				type="radio"
				name="entscheidung-{match.rowNumber}"
				value="neu"
				checked={chosen === 'neu'}
				onchange={() => answer(match.rowNumber, 'neu')}
			/>
			<span><Icon name="user-plus" label={null} />Neu anlegen</span>
		</label>
		<label>
			<input
				type="radio"
				name="entscheidung-{match.rowNumber}"
				value="skip"
				checked={chosen === 'skip'}
				onchange={() => answer(match.rowNumber, 'skip')}
			/>
			<span><Icon name="ban" label={null} />Überspringen</span>
		</label>
	</fieldset>
{/snippet}

{#snippet personChoice(match: RowMatch, person: Person)}
	{@const similarity = similarityOf(match, person.id)}
	<label class="candidate" class:chosen={boundPersonId(match) === person.id}>
		<input
			type="radio"
			name="vorschlag-{match.rowNumber}"
			value={person.id}
			checked={boundPersonId(match) === person.id}
			onchange={() => bindPerson(match.rowNumber, person.id)}
		/>
		<span class="who">
			{@render nameParts(person.name, match.personName)}
			{#if similarity !== undefined}
				<span class="score">{percent(similarity)} %</span>
			{:else}
				<span class="score">gesucht</span>
			{/if}
		</span>
		<span class="prov">
			{provenanceWords(person.id)}
			{#if noteOf(person) !== ''}
				· <Icon name="message-square-text" label="Notiz vorhanden" /> „{noteExcerpt(person)}“
			{/if}
		</span>
		{#if personFieldWords(person) !== ''}
			<span class="prov">{personFieldWords(person)}</span>
		{/if}
	</label>
{/snippet}

{#if event === undefined}
	<p>Veranstaltung nicht gefunden.</p>
	<p><a href={resolve('/')}>Zurück zur Übersicht</a></p>
{:else}
	<div class="page-head">
		<h1>Import — {event.name}</h1>
		{#if table !== null}
			<p class="meta">
				{fileName} · {countWords(table.rows.length, 'Zeile', 'Zeilen')} · {countWords(
					table.columns.length,
					'Spalte',
					'Spalten'
				)}
			</p>
		{/if}
	</div>

	{#if report !== null}
		{@const done = report}
		{@const skipped = done.skippedRowNumbers.length + done.unnamedRowNumbers.length}
		<!-- The Bericht replaces the register: the result is on screen, so the frame status
		     line stays out of it (§3). -->
		<Blatt>
			<section>
				<h2 class="label">Bericht — {fileName}</h2>
				<p class="counts">
					{countWords(done.newPersons.length, 'Person', 'Personen')} neu angelegt ·
					{countWords(done.linkedPersons.length, 'bestehende Person', 'bestehende Personen')}
					verknüpft ·
					{countWords(done.newParticipants.length, 'Teilnehmer', 'Teilnehmer')} angelegt ·
					{countWords(done.updatedParticipants.length, 'Teilnehmer', 'Teilnehmer')} aktualisiert ·
					{countWords(skipped, 'Zeile', 'Zeilen')} übersprungen
				</p>
			</section>

			{#if done.unknownRoleNames.length > 0 || done.rejectedValues.length > 0 || done.unnamedRowNumbers.length > 0}
				<section class="exceptions">
					<h3 class="label">Was nicht übernommen wurde</h3>
					{#each unknownRoles() as missingRole (missingRole.name)}
						<p>
							„{missingRole.name}“ ist in „{event.name}“ keine Rolle — {countWords(
								missingRole.rows,
								'Zeile',
								'Zeilen'
							)} führen den Namen, die Rolle wurde nicht zugewiesen. Rollen werden in der
							<a href={resolve('/event/[id]/einrichtung', { id: event.id })}>Einrichtung</a>
							angelegt.
						</p>
					{/each}
					{#each rejectedFieldNames() as fieldName (fieldName)}
						{@const rejected = done.rejectedValues.filter((value) => value.fieldName === fieldName)}
						<p>
							{countWords(rejected.length, 'Wert passt', 'Werte passen')} nicht zum Feldtyp von
							„{fieldName}“ und {rejected.length === 1 ? 'wurde' : 'wurden'} nicht übernommen:
							{rejected
								.slice(0, 6)
								.map((value) => `Zeile ${value.rowNumber}: „${value.value}“`)
								.join(' · ')}{rejected.length > 6 ? ' …' : ''}
						</p>
					{/each}
					{#if done.unnamedRowNumbers.length > 0}
						<p>
							{countWords(done.unnamedRowNumbers.length, 'Zeile nennt', 'Zeilen nennen')} keinen
							Namen und {done.unnamedRowNumbers.length === 1 ? 'wurde' : 'wurden'} übersprungen:
							{done.unnamedRowNumbers.slice(0, 12).join(', ')}{done.unnamedRowNumbers.length > 12
								? ' …'
								: ''}
						</p>
					{/if}
				</section>
			{/if}

			<section class="onward">
				<a class="btn primary" href={resolve('/event/[id]/teilnehmer', { id: event.id })}>
					<Icon name="users" label={null} />
					Zu den Teilnehmern
				</a>
				<button type="button" class="btn secondary" onclick={startOver}>
					<Icon name="file-input" label={null} />
					Weitere Datei importieren
				</button>
			</section>
		</Blatt>
	{:else if table === null || fileProblem !== null}
		<!-- Nothing below the banner renders: without a readable file and a column that names
		     the Person there is no review to show. -->
		<Blatt>
			<section class="chooser">
				<div class="field">
					<label class="label" for="csv-datei">CSV-Datei</label>
					<input
						bind:this={fileField}
						id="csv-datei"
						type="file"
						accept=".csv,text/csv"
						onchange={(pick) => loadFile(pick.currentTarget)}
					/>
					<p class="hint">
						Die Datei wird nur hier im Browser gelesen. Anschließend werden die Spalten zugeordnet
						und jede Zeile einzeln entschieden — automatisch übernommen wird nichts.
					</p>
				</div>
				{#if table !== null && savedMappings.length > 0}
					<div class="field">
						<label class="label" for="zuordnung-fallback">Import-Zuordnung</label>
						<select
							id="zuordnung-fallback"
							bind:value={selectedMappingId}
							onchange={applySelectedMapping}
						>
							<option value="">Keine — Spalten von Hand zuordnen</option>
							{#each savedMappings as mapping (mapping.id)}
								<option value={mapping.id}>{mapping.name}</option>
							{/each}
						</select>
					</div>
				{/if}
			</section>
		</Blatt>
	{:else}
		<div class="zuordnung">
			<div class="field-inline">
				<label class="label" for="zuordnung">Import-Zuordnung</label>
				<select id="zuordnung" bind:value={selectedMappingId} onchange={applySelectedMapping}>
					<option value="">Keine — Spalten von Hand zuordnen</option>
					{#each savedMappings as mapping (mapping.id)}
						<option value={mapping.id}>{mapping.name}</option>
					{/each}
				</select>
			</div>
			<a class="verwalten" href={resolve('/stammdaten/einrichtung')}>Zuordnungen verwalten</a>
			<button type="button" class="btn quiet" onclick={() => (showAllColumns = !showAllColumns)}>
				{showAllColumns
					? 'Nur zugeordnete Spalten zeigen'
					: `Alle ${table.columns.length} Spalten zeigen`}
			</button>
			<div class="save">
				{#if mapped && selectedMapping !== undefined}
					<button type="button" class="btn quiet" onclick={saveBackToMapping}>
						Unter „{selectedMapping.name}“ sichern
					</button>
				{/if}
				{#if mapped && !namingMapping}
					<button type="button" class="btn quiet" onclick={startNamingMapping}>
						Als neue Zuordnung speichern
					</button>
				{/if}
			</div>
			{#if namingMapping}
				<form class="naming" onsubmit={saveNewMapping}>
					<label class="label" for="zuordnung-name">Name der Zuordnung</label>
					<input
						bind:this={mappingNameField}
						bind:value={mappingName}
						id="zuordnung-name"
						type="text"
						placeholder="z. B. Ticketliste"
						aria-invalid={mappingNameProblem === '' ? undefined : 'true'}
						aria-describedby={mappingNameProblem === '' ? undefined : 'zuordnung-name-fehler'}
						oninput={() => (mappingNameProblem = '')}
					/>
					<button type="submit" class="btn secondary">Speichern</button>
					<button type="button" class="btn quiet" onclick={stopNamingMapping}>Abbrechen</button>
					{#if mappingNameProblem !== ''}
						<p id="zuordnung-name-fehler" class="field-error">{mappingNameProblem}</p>
					{/if}
				</form>
			{/if}
		</div>

		{#if missingColumns.length > 0 || unresolvedColumns.length > 0 || unnamedRows > 0 || !mapped}
			<div class="advisories">
				{#if !mapped}
					<p>
						Noch nennt keine Spalte den Namen. Im Kopf der Spalte
						<em>Person-Identität (Name)</em> wählen — mehrere Spalten ergeben den Namen in
						Dateireihenfolge (Vorname + Nachname). Unten stehen die ersten
						{Math.min(table.rows.length, UNMAPPED_PREVIEW)} Zeilen der Datei.
					</p>
				{/if}
				{#if missingColumns.length > 0}
					<p>
						Spalten dieser Zuordnung fehlen in der Datei, ihre Ziele bleiben leer:
						{missingColumns.join(', ')}
					</p>
				{/if}
				{#if unresolvedColumns.length > 0}
					<p>
						Zuordnungsziele gibt es nicht mehr, diese Spalten werden ignoriert:
						{unresolvedColumns.join(', ')}
					</p>
				{/if}
				{#if unnamedRows > 0}
					<p>
						{countWords(unnamedRows, 'Zeile nennt', 'Zeilen nennen')} keinen Namen und
						{unnamedRows === 1 ? 'wird' : 'werden'} beim Import übersprungen.
					</p>
				{/if}
			</div>
		{/if}

		{#if mapped}
			<div class="tools">
				<div class="chips" role="group" aria-label="Zeilen filtern">
					{#each reviewFilters as candidateFilter (candidateFilter)}
						<button
							type="button"
							class="chip"
							aria-pressed={filter === candidateFilter}
							onclick={() => (filter = candidateFilter)}
						>
							{filterWords[candidateFilter]}
							<span class="count">{filterCount(candidateFilter)}</span>
						</button>
					{/each}
				</div>
				<label class="search">
					<span class="vh">Zeilen durchsuchen</span>
					<Icon name="search" label={null} />
					<!-- type="text", never type="search": Chrome alone clears that on Escape. -->
					<input bind:value={query} type="text" placeholder="Name in der Datei, Vorschlag …" />
				</label>
			</div>

			{#if safeRows.length > 0 || unmatched.length > 0}
				<!-- Sammelaktion, not Vorauswahl: no row arrives decided, the count in the label is
				     the warning, and both acts stay reversible until the commit. -->
				<div class="bulk">
					{#if safeRows.length > 0}
						<button type="button" class="btn secondary" onclick={takeSafeLinks}>
							<Icon name="link" label={null} />
							{countWords(safeRows.length, 'sichere Verknüpfung', 'sichere Verknüpfungen')} übernehmen
						</button>
					{/if}
					{#if unmatched.length > 0}
						<button type="button" class="btn secondary" onclick={createUnmatched}>
							<Icon name="user-plus" label={null} />
							{countWords(unmatched.length, 'Zeile', 'Zeilen')} ohne Vorschlag als neue Person anlegen
						</button>
					{/if}
					<p class="hint">
						Beide Sammelaktionen lassen sich Zeile für Zeile auf „Offen“ zurücknehmen, solange der
						Import nicht ausgeführt ist.
					</p>
				</div>
			{/if}
		{/if}

		<Register caption="Import-Prüfung" skipTo="import-fuss" {head}>
			{#if rows.length === 0}
				<tr>
					<td colspan={columnCount}>
						<EmptyState
							tier="no-matches"
							message={mapped
								? `Keine Zeile unter ${filterDescription()}.`
								: 'Die Datei hat keine Zeilen unter der Kopfzeile.'}
							action={mapped && (filter !== 'alle' || query.trim() !== '')
								? resetAction
								: undefined}
						/>
					</td>
				</tr>
			{:else}
				{#each rows as entry (entry.rowNumber)}
					{@const match = entry.match}
					{@const open = isRowOpen(entry.rowNumber)}
					{@const detailId = `import-detail-${entry.rowNumber}`}
					<tr class:open>
						<td class="zeile num">{entry.rowNumber}</td>
						<td class="name">
							{#if match === null}
								<span class="muted">—</span>
							{:else}
								{@render nameParts(match.personName, boundPersonName(match))}
							{/if}
						</td>
						{#if match === null}
							<td class="muted">–</td>
							<td class="muted">–</td>
							<td class="muted">–</td>
							<td class="muted">–</td>
						{:else}
							{@const grade = gradeMatch(match)}
							{@const beleg = belegOf(match)}
							<td class="entscheidung">{@render decisionGroup(match)}</td>
							<td class="grade">
								<span class="word" data-grade={grade}>
									{#if grade === 'mehrdeutig'}
										<Icon name="triangle-alert" label={null} />
									{/if}
									{gradeWords[grade]}
								</span>
								{#if grade !== 'ohneVorschlag'}
									<span class="score">{percent(bestSimilarity(match))} %</span>
								{/if}
							</td>
							<td class="vorschlag">
								{#if boundPerson(match) === undefined}
									<span class="muted">—</span>
								{:else}
									{@render nameParts(boundPersonName(match), match.personName)}
									{#if match.candidates.length > 1}
										<span class="score">+{match.candidates.length - 1} weitere</span>
									{/if}
								{/if}
							</td>
							<td class="beleg" class:exception={beleg.exception}>
								{beleg.text}
								{#if beleg.note}
									<Icon name="message-square-text" label="Notiz vorhanden" />
								{/if}
							</td>
						{/if}
						{#each shownColumns as column (column.index)}
							<td class:ignored={column.name !== '' && isIgnored(column.name)}>
								{cellValue(entry.rowNumber, column.index)}
							</td>
						{/each}
						<td class="actions">
							{#if match !== null}
								<button
									type="button"
									class="icon-btn row-action"
									data-tip={open ? 'Schließen' : 'Belege'}
									aria-expanded={open}
									aria-controls={detailId}
									onclick={(press) => toggleDetail(entry.rowNumber, press.currentTarget)}
								>
									<span class="vh">
										Belege zu Zeile {entry.rowNumber} · {match.personName}
										{open ? 'schließen' : 'anzeigen'}
									</span>
									<Icon name={open ? 'chevron-down' : 'chevron-right'} label={null} />
								</button>
							{/if}
						</td>
					</tr>
					{#if open && match !== null}
						<tr class="detail" id={detailId}>
							<td colspan={columnCount}>
								<div class="detail-grid">
									<div class="stack">
										{#if match.duplicateOfRowNumber !== undefined}
											<p class="flag">
												<Icon name="triangle-alert" label={null} />
												Derselbe Name steht schon in Zeile {match.duplicateOfRowNumber}.
											</p>
										{/if}
										<fieldset class="candidates">
											<legend class="label">
												Verknüpfen mit — Zeile {entry.rowNumber} · {match.personName}
											</legend>
											{#each detailPersons(match) as person (person.id)}
												{@render personChoice(match, person)}
											{/each}
											{#if detailPersons(match).length === 0}
												<p class="hint">
													Der Abgleich hat keine ähnliche Person gefunden. Wer trotzdem schon im
													Pool steht, wird hier gesucht.
												</p>
											{/if}
										</fieldset>
										<div class="field">
											<label class="label" for="suche-{entry.rowNumber}">
												Person suchen, die der Abgleich nicht vorgeschlagen hat
											</label>
											<input
												bind:value={personQuery}
												id="suche-{entry.rowNumber}"
												type="text"
												placeholder="Name …"
											/>
											{#each searchHits(match) as person (person.id)}
												{@render personChoice(match, person)}
											{/each}
											{#if personQuery.trim() !== '' && searchHits(match).length === 0}
												<p class="hint">Keine weitere Person zu diesem Namen.</p>
											{/if}
										</div>
									</div>

									<div class="stack">
										{#if comparisons(match).length === 0}
											<p class="hint">
												Diese Zeile bringt außer dem Namen nichts mit — es ist keine Spalte
												zugeordnet, die Werte trägt.
											</p>
										{:else}
											<table class="values">
												<caption class="label">Werte dieser Zeile</caption>
												<thead>
													<tr>
														<th scope="col" class="label">Ziel</th>
														<th scope="col" class="label">Aus der Datei</th>
														<th scope="col" class="label">Gespeichert</th>
													</tr>
												</thead>
												<tbody>
													{#each comparisons(match) as comparison (comparison.label)}
														<tr>
															<td>{comparison.label}</td>
															<td>{comparison.fileValue}</td>
															<td class="muted">
																{comparison.storedValue === '' ? '–' : comparison.storedValue}
															</td>
														</tr>
													{/each}
												</tbody>
											</table>
										{/if}
									</div>
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			{/if}
		</Register>

		{#if mapped}
			<!-- The foot states the consequence in words; it is a creation, so it keeps its
			     commit button, and it is not a dialog (§3, §7). -->
			<div class="foot" id="import-fuss" tabindex="-1">
				<p class="tally">
					<span class:pending={tally.offen > 0}>{tally.offen} offen</span>
					<span>· {tally.neu} neue Personen</span>
					<span>· {tally.verknuepft} verknüpft</span>
					<span>· {tally.uebersprungen} übersprungen</span>
				</p>
				<p class="consequence">
					{consequenceSentence()}
					{#if tally.offen > 0}
						{countWords(tally.offen, 'Zeile ist', 'Zeilen sind')} noch offen — „Import ausführen“
						zeigt sie zuerst.
					{/if}
				</p>
				<button
					type="button"
					class="btn primary"
					aria-busy={importing ? 'true' : undefined}
					disabled={importing}
					onclick={runImport}
				>
					{importing ? 'Wird importiert …' : 'Import ausführen'}
				</button>
			</div>
		{:else}
			<p id="import-fuss" class="foot-placeholder" tabindex="-1">
				Der Import wird ausführbar, sobald eine Spalte den Namen liefert.
			</p>
		{/if}
	{/if}
{/if}

<style>
	.page-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-5);
		margin-bottom: var(--space-6);
	}

	h1 {
		font-size: var(--text-xl);
		font-weight: 600;
	}

	.meta {
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.hint {
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.chooser {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	input[type='file'] {
		font-size: var(--text-sm);
	}

	input[type='file']::file-selector-button {
		margin-right: var(--space-4);
		padding: var(--space-3) var(--space-5);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
		color: var(--ink);
		font-size: var(--text-sm);
		cursor: pointer;
	}

	input[type='text'],
	select {
		height: var(--row);
		padding: 0 var(--space-4);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
		color: var(--ink);
		font-size: var(--text-sm);
	}

	/* The Zuordnung bar: what the columns are read as, and where that reading is kept. */
	.zuordnung {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-5);
		margin-bottom: var(--space-4);
		padding: var(--space-4) var(--space-5);
		background: var(--inset);
		border: 1px solid var(--rule);
		border-radius: var(--radius);
	}

	.field-inline {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.verwalten {
		font-size: var(--text-sm);
	}

	.save {
		display: flex;
		gap: var(--space-3);
		margin-left: auto;
	}

	.naming {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding-top: var(--space-4);
		border-top: 1px solid var(--rule);
	}

	.advisories {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-5);
		margin-bottom: var(--space-4);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
		font-size: var(--text-xs);
		color: var(--ink-mute);
		cursor: pointer;
	}

	.chip:hover {
		background: var(--hover);
		color: var(--ink);
	}

	/* aria-pressed carries the state before the ground does — colour is never alone. */
	.chip[aria-pressed='true'] {
		background: var(--selected);
		border-color: var(--accent);
		color: var(--accent);
		font-weight: 700;
	}

	.chip .count {
		font-family: var(--font-code);
		letter-spacing: var(--track-code);
	}

	.search {
		position: relative;
		display: flex;
		align-items: center;
		margin-left: auto;
		color: var(--ink-mute);
	}

	.search :global(svg) {
		position: absolute;
		left: var(--space-4);
	}

	.search input {
		width: 18rem;
		max-width: 100%;
		padding-left: var(--space-7);
	}

	.bulk {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.bulk .hint {
		flex-basis: 100%;
	}

	/* The head carries the Zuordnung, so it is three lines rather than one nowrap row. */
	thead th.label {
		height: auto;
		padding-top: var(--space-3);
		padding-bottom: var(--space-3);
		white-space: normal;
		vertical-align: top;
	}

	.chain,
	.selects {
		display: block;
		margin-top: var(--space-2);
		font-size: var(--text-xs);
		letter-spacing: normal;
		text-transform: none;
		font-weight: 400;
		color: var(--ink-mute);
	}

	.selects {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	select.target {
		max-width: 12rem;
		height: auto;
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-xs);
		letter-spacing: normal;
		text-transform: none;
		font-weight: 400;
	}

	.ignored {
		color: var(--ink-mute);
	}

	/*
		Zeile and Name stay put while the rest scrolls: `Alle Spalten zeigen` can put the
		table over the fold at any time, and a decision without its row number is unreadable.
		The two z-index values above the register's sticky head exist for this alone.
	*/
	td.zeile,
	td.name {
		position: sticky;
		z-index: 1;
		background: var(--paper);
	}

	th.zeile,
	th.name {
		z-index: 3;
	}

	.zeile {
		left: 0;
		width: 4rem;
	}

	.name {
		left: 4rem;
		width: 15rem;
	}

	tr:hover td.zeile,
	tr:hover td.name {
		background: var(--hover);
	}

	tr.open td.zeile,
	tr.open td.name {
		background: var(--selected);
	}

	td.zeile {
		font-family: var(--font-code);
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	td.name {
		font-weight: 600;
	}

	/* Never colour alone: the part of the name that differs is underlined, wavy. */
	.differs {
		text-decoration: underline wavy var(--rule-hard);
		text-underline-offset: 3px;
	}

	.muted {
		color: var(--ink-mute);
	}

	/* A word before a number — the score alone is never shown. */
	.grade .word {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.grade .word[data-grade='sicher'] {
		font-weight: 700;
	}

	.grade .word[data-grade='mehrdeutig'] {
		color: var(--danger);
		font-weight: 700;
	}

	.grade .word[data-grade='schwach'],
	.grade .word[data-grade='ohneVorschlag'] {
		color: var(--ink-mute);
	}

	.score {
		margin-left: var(--space-3);
		font-family: var(--font-code);
		font-size: var(--text-xs);
		letter-spacing: var(--track-code);
		color: var(--ink-mute);
	}

	.beleg {
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.beleg.exception {
		color: var(--ink);
		font-weight: 600;
	}

	/*
		One decision, one value, one tab stop: four radios in one group, styled as a
		segmented control. The inputs stay real radios — the arrows are the browser's.
	*/
	.segmented {
		display: flex;
		border: 1px solid var(--control);
		border-radius: var(--radius);
		padding: 0;
		width: fit-content;
	}

	.segmented label {
		display: flex;
	}

	.segmented label + label span {
		border-left: 1px solid var(--control);
	}

	.segmented input {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.segmented span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		font-size: var(--text-xs);
		color: var(--ink-mute);
		cursor: pointer;
		white-space: nowrap;
	}

	.segmented label:hover span {
		background: var(--hover);
		color: var(--ink);
	}

	.segmented input:checked + span {
		background: var(--selected);
		color: var(--accent);
		font-weight: 700;
	}

	/* The input is clipped, so the focus ring is drawn where the organizer looks. */
	.segmented input:focus-visible + span {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	.segmented input:disabled + span {
		color: var(--ink-mute);
		cursor: default;
		text-decoration: line-through;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 1fr 24rem;
		gap: var(--space-7);
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		min-width: 0;
	}

	.flag {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-size: var(--text-sm);
		color: var(--danger);
	}

	.candidates {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: 0;
		border: 0;
	}

	.candidate {
		display: grid;
		grid-template-columns: auto 1fr;
		column-gap: var(--space-4);
		padding: var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius);
		cursor: pointer;
	}

	.candidate:hover {
		background: var(--hover);
	}

	.candidate.chosen {
		border-color: var(--accent);
	}

	.candidate input {
		grid-row: 1 / span 3;
		align-self: center;
	}

	.candidate .who {
		font-weight: 600;
	}

	.candidate .prov {
		grid-column: 2;
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.values {
		width: 100%;
		font-size: var(--text-xs);
	}

	.values thead th.label {
		position: static;
		background: none;
		border-bottom: 1px solid var(--rule);
	}

	.values caption {
		text-align: left;
		padding-bottom: var(--space-2);
	}

	/*
		The commit sits at the bottom of the register and stays reachable: 150 rows would
		otherwise put it a screen and a half below the last decision.
	*/
	.foot {
		position: sticky;
		bottom: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-5);
		margin-top: var(--space-5);
		padding: var(--space-5);
		background: var(--raised);
		border: 1px solid var(--rule-hard);
		border-radius: var(--radius);
	}

	.tally {
		display: flex;
		gap: var(--space-2);
		font-family: var(--font-code);
		font-size: var(--text-sm);
		letter-spacing: var(--track-code);
		color: var(--ink-mute);
	}

	.tally .pending {
		color: var(--ink);
		font-weight: 700;
	}

	.consequence {
		flex: 1;
		min-width: 16rem;
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.foot .btn {
		margin-left: auto;
	}

	.foot-placeholder {
		margin-top: var(--space-5);
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.counts {
		font-size: var(--text-base);
	}

	.exceptions {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		font-size: var(--text-sm);
	}

	.onward {
		display: flex;
		gap: var(--space-4);
	}

	.onward a.btn {
		text-decoration: none;
	}
</style>
