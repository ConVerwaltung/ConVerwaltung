<script lang="ts">
	import {
		listParticipantFields,
		listPersonFields,
		type CustomFieldDefinition
	} from '$lib/domain/custom-field';
	import type { FilterCondition, ValueTest } from '$lib/domain/export-filter';
	import { previewFilter, type ExportLevel } from '$lib/domain/export-view';
	import { listRoles, type Role } from '$lib/domain/role';
	import { libraryState } from '$lib/library.svelte';
	import { conditionLabel } from './filter-labels';

	interface Props {
		level: ExportLevel;
		/** Required at Participant level. */
		eventId?: string;
		conditions: FilterCondition[];
	}

	let { level, eventId, conditions = $bindable() }: Props = $props();

	interface SubjectOption {
		value: string;
		label: string;
	}

	const ROLE_PREFIX = 'role:';
	const FIELD_PREFIX = 'field:';

	let subject = $state('');
	let roleHolds = $state(true);
	let fieldTest: ValueTest['kind'] = $state('equals');
	let comparisonValue = $state('');

	const personFields = $derived(listPersonFields(libraryState.library.customFields));
	const participantFields = $derived(
		eventId === undefined ? [] : listParticipantFields(libraryState.library.customFields, eventId)
	);
	const eventRoles = $derived(
		eventId === undefined ? [] : listRoles(libraryState.library.roles, eventId)
	);
	const subjectOptions = $derived(buildSubjectOptions(eventRoles, personFields, participantFields));
	const selectedDefinition = $derived(definitionOf(subject));
	const recordWord = $derived(level === 'person' ? 'Personen' : 'Teilnehmern');
	const preview = $derived(previewFilter(libraryState.library, level, eventId, conditions));
	const addInvalid = $derived(
		subject === ''
		|| (selectedDefinition !== undefined && fieldTest === 'equals' && comparisonValue.trim() === '')
	);

	function buildSubjectOptions(
		roles: Role[],
		personDefinitions: CustomFieldDefinition[],
		participantDefinitions: CustomFieldDefinition[]
	): SubjectOption[] {
		const options: SubjectOption[] = [];
		for (const role of roles) {
			options.push({ value: `${ROLE_PREFIX}${role.id}`, label: `Rolle: ${role.name}` });
		}
		for (const definition of personDefinitions) {
			options.push({
				value: `${FIELD_PREFIX}${definition.id}`,
				label: `Person-Feld: ${definition.name}`
			});
		}
		for (const definition of participantDefinitions) {
			options.push({
				value: `${FIELD_PREFIX}${definition.id}`,
				label: `Teilnehmer-Feld: ${definition.name}`
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

	function buildCondition(): FilterCondition | undefined {
		if (subject.startsWith(ROLE_PREFIX)) {
			return { kind: 'role', roleId: subject.slice(ROLE_PREFIX.length), holds: roleHolds };
		}
		if (!subject.startsWith(FIELD_PREFIX)) {
			return undefined;
		}
		const definitionId = subject.slice(FIELD_PREFIX.length);
		if (fieldTest === 'equals') {
			return { kind: 'field', definitionId, test: { kind: 'equals', value: comparisonValue } };
		}
		return { kind: 'field', definitionId, test: { kind: fieldTest } };
	}

	function addCondition() {
		const condition = buildCondition();
		if (condition === undefined) {
			return;
		}
		conditions = [...conditions, condition];
		comparisonValue = '';
	}

	function removeCondition(index: number) {
		conditions = conditions.filter((_, position) => position !== index);
	}

	function labelOf(condition: FilterCondition): string {
		return conditionLabel(condition, libraryState.library.customFields, libraryState.library.roles);
	}
</script>

<h5>Filter</h5>
{#if subjectOptions.length === 0}
	<p>Noch nichts zum Filtern vorhanden — dafür braucht es Rollen oder benutzerdefinierte Felder.</p>
{:else}
	<label>
		Bedingung über
		<select bind:value={subject}>
			<option value="">– wählen –</option>
			{#each subjectOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>

	{#if subject.startsWith(ROLE_PREFIX)}
		<select bind:value={roleHolds}>
			<option value={true}>wird gehalten</option>
			<option value={false}>wird nicht gehalten</option>
		</select>
	{:else if selectedDefinition !== undefined}
		<select bind:value={fieldTest}>
			<option value="equals">ist gleich</option>
			<option value="empty">ist leer</option>
			<option value="notEmpty">ist ausgefüllt</option>
		</select>
		{#if fieldTest === 'equals'}
			{#if selectedDefinition.type === 'number'}
				<input type="number" step="any" bind:value={comparisonValue} />
			{:else if selectedDefinition.type === 'boolean'}
				<select bind:value={comparisonValue}>
					<option value="">–</option>
					<option value="true">ja</option>
					<option value="false">nein</option>
				</select>
			{:else if selectedDefinition.type === 'date'}
				<input type="date" bind:value={comparisonValue} />
			{:else if selectedDefinition.type === 'select'}
				<select bind:value={comparisonValue}>
					<option value="">–</option>
					{#each selectedDefinition.selectOptions ?? [] as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			{:else}
				<input type="text" bind:value={comparisonValue} />
			{/if}
		{/if}
	{/if}

	<button type="button" onclick={addCondition} disabled={addInvalid}>Bedingung hinzufügen</button>
{/if}

{#if conditions.length === 0}
	<p>Ohne Bedingungen umfasst die Export-Ansicht alle Datensätze.</p>
{:else}
	<ul>
		{#each conditions as condition, index (index)}
			<li>
				{labelOf(condition)}
				<button type="button" onclick={() => removeCondition(index)}>Entfernen</button>
			</li>
		{/each}
	</ul>
	<p>Alle Bedingungen müssen zutreffen.</p>
{/if}

<p>
	Trifft auf {preview.matching} von {preview.total}
	{recordWord} zu.
	{#if preview.sampleNames.length > 0}
		<small>
			{preview.sampleNames.join(', ')}{preview.matching > preview.sampleNames.length ? ' …' : ''}
		</small>
	{/if}
</p>
