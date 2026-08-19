<script lang="ts">
	import { tick } from 'svelte';
	import {
		abandonEditor,
		closeEditor,
		isEditorOpen,
		openEditor,
		trackField
	} from '$lib/editor.svelte';

	interface Props {
		id: string;
		label: string;
		value: string;
		oncommit: (value: string) => void;
	}

	let { id, label, value, oncommit }: Props = $props();

	const fieldId = $props.id();
	const editing = $derived(isEditorOpen(id));

	let trigger = $state<HTMLButtonElement | null>(null);
	let field = $state<HTMLInputElement | null>(null);

	function edit(): void {
		openEditor({ id, commit: persist });
	}

	function persist(): void {
		if (field !== null && field.value !== value) {
			oncommit(field.value);
		}
	}

	function revertTo(input: HTMLInputElement): void {
		input.value = value;
		abandonEditor(id);
		void returnFocus();
	}

	// The trigger is replaced by the input while editing, so the button to hand focus back to
	// only exists again once the swap has been undone. This is what retires autofocus.
	async function returnFocus(): Promise<void> {
		await tick();
		trigger?.focus();
	}

	function commitOnEnter(event: KeyboardEvent): void {
		if (event.key !== 'Enter') {
			return;
		}
		event.preventDefault();
		field?.blur();
		void returnFocus();
	}

	$effect(() => {
		const input = field;
		if (input === null) {
			return;
		}
		input.focus();
		input.select();
		return trackField(input, {
			isDirty: () => input.value !== value,
			revert: () => revertTo(input)
		});
	});
</script>

{#if editing}
	<!-- The row already names the thing, so the label is visually hidden: a visible one
	     inside a 36px row wrecks the density. There is no Speichern button and no
	     acknowledgement — blur and Enter commit, Escape reverts. -->
	<label class="vh" for={fieldId}>{label}</label>
	<input
		bind:this={field}
		id={fieldId}
		type="text"
		{value}
		onblur={() => closeEditor(id)}
		onkeydown={commitOnEnter}
	/>
{:else}
	<button bind:this={trigger} type="button" class="swap" onclick={edit}>{value}</button>
{/if}

<style>
	.swap {
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
		cursor: pointer;
	}

	.swap:hover {
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	input {
		width: 100%;
		height: calc(var(--row) - var(--space-4));
		padding: 0 var(--space-3);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
	}
</style>
