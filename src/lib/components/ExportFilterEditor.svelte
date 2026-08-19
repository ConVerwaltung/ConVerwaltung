<script lang="ts">
	import { tick } from 'svelte';
	import {
		listParticipantFields,
		listPersonFields,
		type CustomFieldDefinition
	} from '$lib/domain/custom-field';
	import type { FilterCondition, ValueTest } from '$lib/domain/export-filter';
	import { previewFilter, type ExportLevel } from '$lib/domain/export-view';
	import { listRoles, type Role } from '$lib/domain/role';
	import { libraryState } from '$lib/library.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import { conditionLabel } from './filter-labels';

	interface Props {
		level: ExportLevel;
		/** Required at Participant level. */
		eventId?: string;
		conditions: readonly FilterCondition[];
		onchange: (conditions: FilterCondition[]) => void;
	}

	let { level, eventId, conditions, onchange }: Props = $props();

	interface SubjectOption {
		value: string;
		label: string;
	}

	const ROLE_PREFIX = 'role:';
	const FIELD_PREFIX = 'field:';

	const uid = $props.id();
	const subjectId = `${uid}-gegenstand`;
	const subjectErrorId = `${uid}-gegenstand-fehler`;
	const testId = `${uid}-vergleich`;
	const valueId = `${uid}-wert`;
	const valueErrorId = `${uid}-wert-fehler`;

	let adding = $state(false);
	let subject = $state('');
	let roleHolds = $state(true);
	let fieldTest: ValueTest['kind'] = $state('equals');
	let comparisonValue = $state('');
	let subjectError = $state<string | null>(null);
	let valueError = $state<string | null>(null);

	let addButton = $state<HTMLButtonElement | null>(null);
	let subjectField = $state<HTMLSelectElement | null>(null);
	let valueField = $state<HTMLInputElement | HTMLSelectElement | null>(null);

	const personFields = $derived(listPersonFields(libraryState.library.customFields));
	// At Person level there are no Teilnehmer to hold a Rolle and no Teilnehmer-Feld to
	// read, so both groups are absent rather than empty.
	const participantFields = $derived(
		level === 'person' || eventId === undefined
			? []
			: listParticipantFields(libraryState.library.customFields, eventId)
	);
	const eventRoles = $derived(
		level === 'person' || eventId === undefined
			? []
			: listRoles(libraryState.library.roles, eventId)
	);
	const subjectOptions = $derived(buildSubjectOptions(eventRoles, personFields, participantFields));
	const selectedDefinition = $derived(definitionOf(subject));
	const recordWord = $derived(level === 'person' ? 'Personen' : 'Teilnehmern');
	const preview = $derived(previewFilter(libraryState.library, level, eventId, conditions));

	function buildSubjectOptions(
		roles: Role[],
		personDefinitions: CustomFieldDefinition[],
		participantDefinitions: CustomFieldDefinition[]
	): SubjectOption[] {
		const options: SubjectOption[] = [];
		for (const role of roles) {
			options.push({ value: `${ROLE_PREFIX}${role.id}`, label: `Rolle · ${role.name}` });
		}
		for (const definition of personDefinitions) {
			options.push({
				value: `${FIELD_PREFIX}${definition.id}`,
				label: `Person-Feld · ${definition.name}`
			});
		}
		for (const definition of participantDefinitions) {
			options.push({
				value: `${FIELD_PREFIX}${definition.id}`,
				label: `Teilnehmer-Feld · ${definition.name}`
			});
		}
		return options;
	}

	function definitionOf(selected: string): CustomFieldDefinition | undefined {
		if (!selected.startsWith(FIELD_PREFIX)) {
			return undefined;
		}
		return libraryState.library.customFields[selected.slice(FIELD_PREFIX.length)];
	}

	function labelOf(condition: FilterCondition): string {
		return conditionLabel(condition, libraryState.library.customFields, libraryState.library.roles);
	}

	/*
		A condition is several decisions that only mean something together — a blank
		comparison value is refused by the domain — so it stays a draft until submitted,
		unlike every edit of one that already exists.
	*/

	async function startAdding(): Promise<void> {
		adding = true;
		await tick();
		subjectField?.focus();
	}

	function stopAdding(): void {
		adding = false;
		subject = '';
		roleHolds = true;
		fieldTest = 'equals';
		comparisonValue = '';
		subjectError = null;
		valueError = null;
		addButton?.focus();
	}

	function chooseSubject(chosen: string): void {
		subject = chosen;
		comparisonValue = '';
		subjectError = null;
		valueError = null;
	}

	function buildCondition(): FilterCondition | undefined {
		if (subject.startsWith(ROLE_PREFIX)) {
			return { kind: 'role', roleId: subject.slice(ROLE_PREFIX.length), holds: roleHolds };
		}
		const definitionId = subject.slice(FIELD_PREFIX.length);
		if (fieldTest === 'equals') {
			return { kind: 'field', definitionId, test: { kind: 'equals', value: comparisonValue } };
		}
		return { kind: 'field', definitionId, test: { kind: fieldTest } };
	}

	function commitCondition(submit: SubmitEvent): void {
		submit.preventDefault();
		if (subject === '') {
			subjectError = 'Eine Bedingung braucht einen Gegenstand.';
			subjectField?.focus();
			return;
		}
		if (selectedDefinition !== undefined && fieldTest === 'equals' && comparisonValue.trim() === '') {
			valueError = 'Ein Vergleichswert ist nötig — oder „ist leer“ wählen.';
			valueField?.focus();
			return;
		}
		const condition = buildCondition();
		if (condition === undefined) {
			return;
		}
		onchange([...conditions, condition]);
		stopAdding();
	}

	function removeCondition(index: number): void {
		onchange(conditions.filter((_, position) => position !== index));
	}
</script>

<section>
	<div class="section-head">
		<h2 class="label">Filter</h2>
		<p class="tally">{preview.matching} von {preview.total} {recordWord}</p>
		<button
			bind:this={addButton}
			type="button"
			class="btn quiet"
			disabled={subjectOptions.length === 0}
			aria-describedby={subjectOptions.length === 0 ? `${uid}-kein-gegenstand` : undefined}
			onclick={startAdding}
		>
			<Icon name="plus" label={null} />
			Bedingung
		</button>
	</div>

	{#if subjectOptions.length === 0}
		<!-- The disabled control states its reason, so it is never a dead button (§0.5). -->
		<p id="{uid}-kein-gegenstand" class="note">
			Noch nichts zum Filtern vorhanden — dafür braucht es Rollen oder benutzerdefinierte Felder.
		</p>
	{/if}

	{#if adding}
		<form class="create" onsubmit={commitCondition}>
			<div class="field">
				<label class="label" for={subjectId}>Bedingung über</label>
				<select
					bind:this={subjectField}
					id={subjectId}
					value={subject}
					aria-invalid={subjectError !== null ? 'true' : undefined}
					aria-describedby={subjectError !== null ? subjectErrorId : undefined}
					onchange={(pick) => chooseSubject(pick.currentTarget.value)}
				>
					<!-- A disabled placeholder, because the choice is mandatory (§4). -->
					<option value="" disabled>Rolle oder Feld wählen …</option>
					{#each subjectOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
				{#if subjectError !== null}
					<p id={subjectErrorId} class="field-error">{subjectError}</p>
				{/if}
			</div>

			{#if subject.startsWith(ROLE_PREFIX)}
				<div class="field">
					<label class="label" for={testId}>Vergleich</label>
					<select bind:value={roleHolds} id={testId}>
						<option value={true}>wird gehalten</option>
						<option value={false}>wird nicht gehalten</option>
					</select>
				</div>
			{:else if selectedDefinition !== undefined}
				<div class="field">
					<label class="label" for={testId}>Vergleich</label>
					<select bind:value={fieldTest} id={testId} onchange={() => (valueError = null)}>
						<option value="equals">ist gleich</option>
						<option value="empty">ist leer</option>
						<option value="notEmpty">ist ausgefüllt</option>
					</select>
				</div>

				{#if fieldTest === 'equals'}
					<div class="field">
						<label class="label" for={valueId}>Wert</label>
						{#if selectedDefinition.type === 'number'}
							<input
								bind:this={valueField}
								bind:value={comparisonValue}
								id={valueId}
								type="number"
								step="any"
								aria-invalid={valueError !== null ? 'true' : undefined}
								aria-describedby={valueError !== null ? valueErrorId : undefined}
								oninput={() => (valueError = null)}
							/>
						{:else if selectedDefinition.type === 'boolean'}
							<select
								bind:this={valueField}
								bind:value={comparisonValue}
								id={valueId}
								onchange={() => (valueError = null)}
							>
								<option value="" disabled>ja oder nein wählen …</option>
								<option value="true">ja</option>
								<option value="false">nein</option>
							</select>
						{:else if selectedDefinition.type === 'date'}
							<input
								bind:this={valueField}
								bind:value={comparisonValue}
								id={valueId}
								type="date"
								aria-invalid={valueError !== null ? 'true' : undefined}
								aria-describedby={valueError !== null ? valueErrorId : undefined}
								oninput={() => (valueError = null)}
							/>
						{:else if selectedDefinition.type === 'select'}
							<select
								bind:this={valueField}
								bind:value={comparisonValue}
								id={valueId}
								onchange={() => (valueError = null)}
							>
								<option value="" disabled>Option wählen …</option>
								{#each selectedDefinition.selectOptions ?? [] as option (option)}
									<option value={option}>{option}</option>
								{/each}
							</select>
						{:else}
							<input
								bind:this={valueField}
								bind:value={comparisonValue}
								id={valueId}
								type="text"
								aria-invalid={valueError !== null ? 'true' : undefined}
								aria-describedby={valueError !== null ? valueErrorId : undefined}
								oninput={() => (valueError = null)}
							/>
						{/if}
						{#if valueError !== null}
							<p id={valueErrorId} class="field-error">{valueError}</p>
						{/if}
					</div>
				{/if}
			{/if}

			<div class="commit">
				<button type="submit" class="btn primary">Hinzufügen</button>
				<button type="button" class="btn quiet" onclick={stopAdding}>Abbrechen</button>
			</div>
		</form>
	{/if}

	{#if conditions.length === 0}
		<p class="note">Ohne Bedingung erfasst die Ansicht alle {recordWord}.</p>
	{:else}
		<!-- A flat list, and UND is the only way conditions combine: no ODER, no groups, no
		     expression tree. -->
		<ul class="conditions">
			{#each conditions as condition, index (index)}
				<li>
					<span class="what">{labelOf(condition)}</span>
					<button
						type="button"
						class="icon-btn"
						data-tip="Bedingung entfernen"
						onclick={() => removeCondition(index)}
					>
						<span class="vh">Bedingung „{labelOf(condition)}“ entfernen</span>
						<Icon name="x" label={null} />
					</button>
				</li>
			{/each}
		</ul>
		{#if conditions.length > 1}
			<p class="note">Alle Bedingungen müssen zutreffen.</p>
		{/if}
	{/if}
</section>

<style>
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

	.section-head .btn {
		margin-left: auto;
		flex: none;
		align-self: center;
	}

	.note {
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.create {
		display: flex;
		flex-wrap: wrap;
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

	input,
	select {
		height: var(--row);
		max-width: 100%;
		padding: 0 var(--space-3);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
	}

	.commit {
		display: flex;
		gap: var(--space-4);
		margin-left: auto;
		align-self: flex-end;
	}

	.conditions {
		margin-bottom: var(--space-3);
		padding: 0;
		list-style: none;
	}

	.conditions li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--row);
		border-bottom: 1px solid var(--rule);
		font-size: var(--text-sm);
	}

	.conditions li:last-child {
		border-bottom: 0;
	}

	.what {
		flex: 1;
		min-width: 0;
	}
</style>
