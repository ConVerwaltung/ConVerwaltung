<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		confirmLabel: string;
		onconfirm: () => void;
		onclose: () => void;
		nameToType?: string;
		children: Snippet;
	}

	let { title, confirmLabel, onconfirm, onclose, nameToType, children }: Props = $props();

	// Mounted to be open: the call site renders this only while the decision is pending, so
	// every raise starts with an empty confirmation field and there is no second open flag
	// to keep in step.
	const uid = $props.id();
	const titleId = `${uid}-titel`;
	const nameId = `${uid}-name`;
	const errorId = `${uid}-fehler`;

	let dialog!: HTMLDialogElement;
	let cancel!: HTMLButtonElement;
	let nameField = $state<HTMLInputElement | null>(null);
	let typedName = $state('');
	let mismatch = $state(false);

	$effect(() => {
		dialog.showModal();
		cancel.focus();
	});

	function decide(event: SubmitEvent): void {
		if (nameToType === undefined || typedName.trim() === nameToType) {
			onconfirm();
			return;
		}
		event.preventDefault();
		mismatch = true;
		nameField?.focus();
	}
</script>

<!-- Native <dialog> in the top layer: no z-index scale, and the focus trap and Escape come
     free. Every dialog in the app is destructive, so the confirm is the only bordered
     destructive control and focus still starts on Abbrechen. -->
<dialog bind:this={dialog} aria-labelledby={titleId} {onclose}>
	<h2 id={titleId}>{title}</h2>
	<div class="cascade">{@render children()}</div>
	<form method="dialog" onsubmit={decide}>
		{#if nameToType !== undefined}
			<label class="label" for={nameId}>Zur Bestätigung den Namen eingeben</label>
			<input
				bind:this={nameField}
				bind:value={typedName}
				id={nameId}
				type="text"
				autocomplete="off"
				aria-invalid={mismatch ? 'true' : undefined}
				aria-describedby={mismatch ? errorId : undefined}
				oninput={() => (mismatch = false)}
			/>
			{#if mismatch}
				<p id={errorId} class="field-error">Der eingegebene Name stimmt nicht überein.</p>
			{/if}
		{/if}
		<div class="choices">
			<button bind:this={cancel} type="button" class="btn secondary" onclick={() => dialog.close()}>
				Abbrechen
			</button>
			<button type="submit" class="btn secondary destructive">{confirmLabel}</button>
		</div>
	</form>
</dialog>

<style>
	dialog {
		/* The reset zeroes every margin, which would strand a modal dialog in the corner. */
		margin: auto;
		width: min(28rem, 100%);
		padding: var(--space-6);
		background: var(--surface);
		border: 1px solid var(--rule-hard);
		border-radius: var(--radius);
		color: var(--ink);
	}

	/* The backdrop is the only separation cue this direction has — there are no shadows. */
	dialog::backdrop {
		background: var(--scrim);
	}

	h2 {
		font-size: var(--text-base);
		font-weight: 600;
	}

	.cascade {
		margin-top: var(--space-4);
		font-size: var(--text-sm);
	}

	label {
		display: block;
		margin-top: var(--space-6);
		margin-bottom: var(--space-2);
	}

	input {
		width: 100%;
		height: var(--row);
		padding: 0 var(--space-4);
		background: var(--surface);
		border: 1px solid var(--control);
		border-radius: var(--radius);
	}

	.field-error {
		margin-top: var(--space-2);
	}

	.choices {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-4);
		margin-top: var(--space-6);
	}
</style>
