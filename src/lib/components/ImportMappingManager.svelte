<script lang="ts">
	import type { ColumnTarget, ImportMapping } from '$lib/domain/import-mapping';
	import {
		duplicateImportMapping,
		identityColumnsOf,
		isImportMappingNameDefined,
		listImportMappingsByName,
		renameImportMapping
	} from '$lib/domain/import-mapping';
	import { closeEditor, isEditorOpen, openEditor } from '$lib/editor.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import { libraryState, removeRecords, upsertRecord } from '$lib/library.svelte';
	import Blatt from './Blatt.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import EmptyState from './EmptyState.svelte';
	import InlineEditor from './InlineEditor.svelte';

	// The rename is an in-row swap with no submit, so a rejected name states its reason at
	// the row it snapped back into.
	let renameError = $state<{ id: string; message: string } | null>(null);
	let removing = $state<ImportMapping | null>(null);

	// The row that carried the trigger goes with the Zuordnung, and this Blatt has no
	// action of its own — a Zuordnung is only ever created in an Import — so focus lands on
	// the section.
	let section = $state<HTMLElement | null>(null);

	const mappings = $derived(listImportMappingsByName(libraryState.library.importMappings));

	function renameEditorId(mappingId: string): string {
		return `zuordnung-${mappingId}`;
	}

	function detailEditorId(mappingId: string): string {
		return `zuordnung-spalten-${mappingId}`;
	}

	// The columns keep the order they were mapped in, which is the order of the file they
	// were read from — the order the organizer will see them in again.
	function columnsOf(mapping: ImportMapping): [string, ColumnTarget][] {
		return Object.entries(mapping.columns);
	}

	function identityChainLabel(mapping: ImportMapping): string {
		return identityColumnsOf(mapping.columns).join(' + ');
	}

	function fieldName(definitionId: string): string {
		return libraryState.library.customFields[definitionId]?.name ?? 'Feld nicht mehr vorhanden';
	}

	// A Teilnehmer-Feld travels as a name because it is defined per Veranstaltung, so it is
	// resolved when the Import commits — here it is stated as what it says, nothing more.
	function targetLabel(target: ColumnTarget): string {
		switch (target.kind) {
			case 'identity':
				return 'Person-Identität (Name)';
			case 'personField':
				return `Person-Feld: ${fieldName(target.definitionId)}`;
			case 'participantField':
				return `Teilnehmer-Feld: ${target.fieldName}`;
			case 'role':
				return 'Rolle';
		}
	}

	async function commitRename(mapping: ImportMapping, typed: string): Promise<void> {
		renameError = null;
		const name = typed.trim();
		if (name === '' || name === mapping.name) {
			return;
		}
		if (isImportMappingNameDefined(libraryState.library.importMappings, name)) {
			renameError = { id: mapping.id, message: 'Name bereits vergeben.' };
			return;
		}
		await upsertRecord(
			'importMappings',
			renameImportMapping(libraryState.library.importMappings, mapping, name)
		);
	}

	async function duplicate(mapping: ImportMapping): Promise<void> {
		await upsertRecord(
			'importMappings',
			duplicateImportMapping(libraryState.library.importMappings, mapping)
		);
	}

	function toggleDetail(mapping: ImportMapping, trigger: HTMLElement): void {
		if (isEditorOpen(detailEditorId(mapping.id))) {
			closeEditor(detailEditorId(mapping.id));
			trigger.focus();
			return;
		}
		openEditor({ id: detailEditorId(mapping.id), trigger });
	}

	// Nothing else goes: a Zuordnung describes how a file was read, and what was read from
	// it became Personen und Teilnehmer, which stand on their own.
	async function removeMapping(mapping: ImportMapping): Promise<void> {
		await removeRecords([{ section: 'importMappings', id: mapping.id }]);
		if (libraryState.writeFailure !== null) {
			return;
		}
		section?.focus();
	}
</script>

<!-- A section manager renders <h2> and stops there: it is always a section, never a page. -->
<Blatt>
	<section bind:this={section} tabindex="-1">
		<div class="section-head">
			<h2 class="label">
				<Icon name="file-input" label={null} />
				Import-Zuordnungen
			</h2>
			<p class="note">Wie die Spalten einer Datei gelesen werden — in jeder Veranstaltung.</p>
		</div>

		{#if mappings.length === 0}
			<!-- No action: eine Zuordnung entsteht nur im Import, an einer echten Datei (§9). -->
			<EmptyState
				tier="nothing-yet"
				icon="file-input"
				message="Noch keine Import-Zuordnungen. Eine entsteht im Import einer Veranstaltung: dort werden die Spalten einer Datei zugeordnet und unter einem Namen gesichert."
			/>
		{:else}
			<table>
				<thead>
					<tr>
						<th scope="col" class="label">Zuordnung</th>
						<th scope="col" class="label">Name aus</th>
						<th scope="col" class="label num">Spalten</th>
						<th scope="col" class="label"><span class="vh">Aktionen</span></th>
					</tr>
				</thead>
				<tbody>
					{#each mappings as mapping (mapping.id)}
						{@const open = isEditorOpen(detailEditorId(mapping.id))}
						{@const detailId = `zuordnung-detail-${mapping.id}`}
						<tr class:open>
							<td class="name">
								<InlineEditor
									id={renameEditorId(mapping.id)}
									label="Name der Zuordnung"
									value={mapping.name}
									oncommit={(name) => commitRename(mapping, name)}
								/>
								{#if renameError?.id === mapping.id}
									<p class="field-error">{renameError.message}</p>
								{/if}
							</td>
							<td class="code">{identityChainLabel(mapping)}</td>
							<td class="num">{columnsOf(mapping).length}</td>
							<td class="actions">
								<!-- The columns are shown, never edited: a Zuordnung is remapped during an
								     Import, against a real file, which is the only place they can be judged. -->
								<button
									type="button"
									class="icon-btn row-action"
									data-tip={open ? 'Schließen' : 'Spalten zeigen'}
									aria-expanded={open}
									aria-controls={detailId}
									onclick={(press) => toggleDetail(mapping, press.currentTarget)}
								>
									<span class="vh">
										Spalten der Zuordnung „{mapping.name}“ {open ? 'schließen' : 'zeigen'}
									</span>
									<Icon name={open ? 'chevron-down' : 'chevron-right'} label={null} />
								</button>
								<button
									type="button"
									class="icon-btn row-action"
									data-tip="Duplizieren"
									onclick={() => duplicate(mapping)}
								>
									<span class="vh">Zuordnung „{mapping.name}“ duplizieren</span>
									<Icon name="copy" label={null} />
								</button>
								<button
									type="button"
									class="icon-btn row-action destructive"
									data-tip="Zuordnung entfernen"
									onclick={() => (removing = mapping)}
								>
									<span class="vh">Zuordnung „{mapping.name}“ entfernen</span>
									<Icon name="trash-2" label={null} />
								</button>
							</td>
						</tr>

						{#if open}
							<tr class="detail" id={detailId}>
								<td colspan="4">
									<dl class="targets">
										{#each columnsOf(mapping) as [column, target] (column)}
											<div class="pair">
												<dt>{column}</dt>
												<!-- The pairing is the dt/dd relation; the arrow only draws it. -->
												<dd>
													<span class="arrow" aria-hidden="true">→</span>
													{targetLabel(target)}
												</dd>
											</div>
										{/each}
									</dl>
									<p class="note">
										Umgeordnet wird im Import, an einer echten Datei — und dort unter demselben
										Namen gesichert. Spalten der Datei ohne Eintrag werden übergangen.
									</p>
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
		title="Import-Zuordnung entfernen"
		confirmLabel="Entfernen"
		onconfirm={() => removeMapping(target)}
		onclose={() => (removing = null)}
	>
		Die Zuordnung „{target.name}“ wird entfernt. Bereits importierte Personen und Teilnehmer
		bleiben unberührt — ein Import dieser Dateiform ordnet die Spalten dann wieder von Hand zu.
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
	}

	.note {
		font-size: var(--text-xs);
		color: var(--ink-mute);
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

	td.code {
		font-family: var(--font-code);
		font-size: var(--text-xs);
		letter-spacing: var(--track-code);
		color: var(--ink-mute);
	}

	td.name {
		font-weight: 600;
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

	.targets {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: var(--space-3) var(--space-6);
	}

	.pair {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		min-width: 0;
	}

	dt {
		font-family: var(--font-code);
		font-size: var(--text-xs);
		letter-spacing: var(--track-code);
		font-weight: 600;
	}

	dd {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		min-width: 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.arrow {
		font-family: var(--font-code);
	}

	.detail .note {
		margin-top: var(--space-5);
	}
</style>
