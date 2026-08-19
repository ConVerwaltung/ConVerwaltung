<script lang="ts">
	import type { CustomFieldDefinition } from '$lib/domain/custom-field';
	import { revertible } from '$lib/editor.svelte';
	import Icon from '$lib/icons/Icon.svelte';

	interface Props {
		definition: CustomFieldDefinition;
		value: string;
		onsave: (value: string) => void;
	}

	let { definition, value, onsave }: Props = $props();

	const fieldId = $props.id();

	// The input is the display: there is no editor mode, no Speichern button and no
	// acknowledgement. A select or a checkbox persists on change, a typed field on change
	// too — which the browser raises on blur and on Enter. Escape puts the field back,
	// through the same ladder every other editor answers to.
	const stored = () => value;

	function saveUnlessBrowserRejects(inputEvent: Event & { currentTarget: HTMLInputElement }) {
		if (!inputEvent.currentTarget.validity.valid) {
			inputEvent.currentTarget.reportValidity();
			return;
		}
		onsave(inputEvent.currentTarget.value);
	}
</script>

<div class="field">
	<label class="label" for={fieldId}>
		{definition.name}
		<!-- Scope is marked by the rare case: a Person-Feld carries the globe, a
		     Teilnehmer-Feld carries nothing. -->
		{#if definition.level === 'person'}
			<Icon name="globe" label="Person-Feld" />
		{/if}
	</label>
	{#if definition.type === 'number'}
		<input
			id={fieldId}
			type="number"
			step="any"
			{value}
			onchange={saveUnlessBrowserRejects}
			use:revertible={stored}
		/>
	{:else if definition.type === 'boolean'}
		<!-- A checkbox cannot show "empty"; unchecking clears the value instead of storing 'false'. -->
		<input
			id={fieldId}
			type="checkbox"
			checked={value === 'true'}
			onchange={(inputEvent) => onsave(inputEvent.currentTarget.checked ? 'true' : '')}
		/>
	{:else if definition.type === 'date'}
		<input
			id={fieldId}
			type="date"
			{value}
			onchange={saveUnlessBrowserRejects}
			use:revertible={stored}
		/>
	{:else if definition.type === 'select'}
		<!-- A selectable „– kein –“, because an empty custom value is legal (§4). -->
		<select id={fieldId} {value} onchange={(inputEvent) => onsave(inputEvent.currentTarget.value)}>
			<option value="">– kein –</option>
			{#each definition.selectOptions ?? [] as option (option)}
				<option value={option}>{option}</option>
			{/each}
		</select>
	{:else}
		<input
			id={fieldId}
			type="text"
			{value}
			onchange={(inputEvent) => onsave(inputEvent.currentTarget.value)}
			use:revertible={stored}
		/>
	{/if}
</div>

<style>
	/* The label sits above the input, never beside it and never as a placeholder (§4). */
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}

	label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	input:not([type='checkbox']),
	select {
		width: 100%;
		height: calc(var(--row) - var(--space-4));
		padding: 0 var(--space-3);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
	}

	input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		margin: var(--space-2) 0;
		accent-color: var(--accent);
	}
</style>
