<script lang="ts">
	import type { CustomFieldDefinition } from '$lib/domain/custom-field';

	interface Props {
		definition: CustomFieldDefinition;
		value: string;
		onsave: (value: string) => void;
	}

	let { definition, value, onsave }: Props = $props();

	function saveUnlessBrowserRejects(inputEvent: Event & { currentTarget: HTMLInputElement }) {
		if (!inputEvent.currentTarget.validity.valid) {
			inputEvent.currentTarget.reportValidity();
			return;
		}
		onsave(inputEvent.currentTarget.value);
	}
</script>

<label>
	{definition.name}
	{#if definition.type === 'number'}
		<input type="number" step="any" {value} onchange={saveUnlessBrowserRejects} />
	{:else if definition.type === 'boolean'}
		<!-- A checkbox cannot show "empty"; unchecking clears the value instead of storing 'false'. -->
		<input
			type="checkbox"
			checked={value === 'true'}
			onchange={(inputEvent) => onsave(inputEvent.currentTarget.checked ? 'true' : '')}
		/>
	{:else if definition.type === 'date'}
		<input type="date" {value} onchange={saveUnlessBrowserRejects} />
	{:else if definition.type === 'select'}
		<select {value} onchange={(inputEvent) => onsave(inputEvent.currentTarget.value)}>
			<option value="">–</option>
			{#each definition.selectOptions ?? [] as option (option)}
				<option value={option}>{option}</option>
			{/each}
		</select>
	{:else}
		<input
			type="text"
			{value}
			onchange={(inputEvent) => onsave(inputEvent.currentTarget.value)}
		/>
	{/if}
</label>
