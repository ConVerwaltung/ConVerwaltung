import type { Action } from 'svelte/action';

/*
	One editor is open in the whole app at a time, which is what makes a second inline-edit
	implementation impossible rather than merely discouraged. A single-field swap and an
	expanded detail row are the same thing here: both are the innermost open editor, both
	close on Escape, and opening either commits whatever was open before.
*/
interface OpenEditor {
	id: string;
	trigger?: HTMLElement | null;
	commit?: () => void;
}

/*
	A field that can be put back the way it was found. Registered per node so the Escape
	ladder can ask the focused element alone, rather than every screen tracking its own.
*/
interface RevertibleField {
	isDirty: () => boolean;
	revert: () => void;
}

const revertibleFields = new WeakMap<Element, RevertibleField>();

export const editorState = $state({ open: null as OpenEditor | null });

export function isEditorOpen(id: string): boolean {
	return editorState.open?.id === id;
}

export function openEditor(editor: OpenEditor): void {
	editorState.open?.commit?.();
	editorState.open = editor;
}

export function closeEditor(id: string): void {
	if (!isEditorOpen(id)) {
		return;
	}
	editorState.open?.commit?.();
	editorState.open = null;
}

export function abandonEditor(id: string): void {
	if (!isEditorOpen(id)) {
		return;
	}
	editorState.open = null;
}

export function trackField(node: Element, field: RevertibleField): () => void {
	revertibleFields.set(node, field);
	return () => {
		revertibleFields.delete(node);
	};
}

/* For the fields that have no editor mode at all — the input is the display. */
export const revertible: Action<HTMLInputElement | HTMLTextAreaElement, () => string> = (
	node,
	stored
) => {
	const forget = trackField(node, {
		isDirty: () => node.value !== stored(),
		revert: () => {
			node.value = stored();
		}
	});
	return { destroy: forget };
};

/*
	Escape has one meaning, applied to the innermost open thing, and it never navigates and
	never clears a filter. A modal dialog takes the key natively before this sees it, so the
	only thing left to decide is whether an uncommitted field outranks the row around it —
	it does, because inside a detail row the fields have no editor mode of their own.
*/
export function handleEscape(event: KeyboardEvent): void {
	if (event.key !== 'Escape') {
		return;
	}
	const source = event.target as Element | null;
	if (source === null || source.closest('dialog[open]') !== null) {
		return;
	}
	const field = revertibleFields.get(source);
	if (field !== undefined && field.isDirty()) {
		field.revert();
		return;
	}
	closeInnermostEditor();
}

function closeInnermostEditor(): void {
	const editor = editorState.open;
	if (editor === null) {
		return;
	}
	abandonEditor(editor.id);
	editor.trigger?.focus();
}
