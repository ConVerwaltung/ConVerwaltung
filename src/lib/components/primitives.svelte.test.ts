import { createRawSnippet, tick } from 'svelte';
import { fireEvent, render } from '@testing-library/svelte';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { editorState, handleEscape } from '$lib/editor.svelte';
import { arrowLayer } from './register-arrows';
import ConfirmDialog from './ConfirmDialog.svelte';
import EmptyState from './EmptyState.svelte';
import InlineEditor from './InlineEditor.svelte';
import Register from './Register.svelte';

// The commitment is WCAG 2.2 AA; axe's best-practice rules are not part of it, and a
// primitive rendered on its own would fail them for sitting outside a landmark.
async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
	const results = await axe.run(container, {
		runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
	});
	expect(results.violations).toEqual([]);
}

function html(markup: string) {
	return createRawSnippet(() => ({ render: () => markup }));
}

const columns = html('<tr><th scope="col" class="label">Name</th><th scope="col">Rollen</th></tr>');

const rows = html(
	'<tr><td>Anna Meier</td><td class="actions">' +
		'<button type="button" class="icon-btn row-action" data-tip="Bearbeiten">' +
		'<span class="vh">Anna Meier bearbeiten</span></button>' +
		'<button type="button" class="icon-btn row-action destructive" data-tip="Entfernen">' +
		'<span class="vh">Anna Meier entfernen</span></button>' +
		'</td></tr>'
);

describe('the register', () => {
	it('is a table of columns and data cells, ahead of a link that skips it', async () => {
		const { container, getByRole } = render(Register, {
			props: { caption: 'Teilnehmer', skipTo: 'nach-dem-register', head: columns, children: rows }
		});

		expect(getByRole('link', { name: 'Register überspringen' }).getAttribute('href')).toBe(
			'#nach-dem-register'
		);
		expect(getByRole('table', { name: 'Teilnehmer' })).toBeDefined();
		expect(getByRole('columnheader', { name: 'Name' })).toBeDefined();
		await expectNoAxeViolations(container);
	});

	it('names every row action, so an icon-only control is never nested inside another', async () => {
		const { container, getByRole } = render(Register, {
			props: { caption: 'Teilnehmer', skipTo: 'nach-dem-register', head: columns, children: rows }
		});

		expect(getByRole('button', { name: 'Anna Meier entfernen' })).toBeDefined();
		await expectNoAxeViolations(container);
	});
});

describe('the arrow layer', () => {
	let table: HTMLTableElement;
	let layer: ReturnType<typeof arrowLayer>;

	function control(row: number, column: number): HTMLButtonElement {
		const buttons = table.querySelectorAll<HTMLButtonElement>('tbody tr button');
		return buttons[row * 2 + column];
	}

	beforeEach(() => {
		table = document.createElement('table');
		table.innerHTML = `<tbody>
			<tr><td><button type="button">bearbeiten 1</button></td><td><button type="button">entfernen 1</button></td></tr>
			<tr class="detail"><td colspan="2">Notiz</td></tr>
			<tr><td><button type="button">bearbeiten 2</button></td><td><button type="button">entfernen 2</button></td></tr>
		</tbody>`;
		document.body.append(table);
		layer = arrowLayer(table);
	});

	afterEach(() => {
		layer?.destroy?.();
		table.remove();
	});

	it('moves to the corresponding control one row down, stepping over a detail row', async () => {
		const source = control(0, 1);
		source.focus();

		await fireEvent.keyDown(source, { key: 'ArrowDown' });

		expect(document.activeElement).toBe(control(1, 1));
	});

	it('leaves a radio group its own arrows, because nothing may depend on the layer', async () => {
		const radio = document.createElement('input');
		radio.type = 'radio';
		table.querySelector('td')?.append(radio);
		radio.focus();

		await fireEvent.keyDown(radio, { key: 'ArrowDown' });

		expect(document.activeElement).toBe(radio);
	});
});

describe('the inline editor', () => {
	const editor = { id: 'veranstaltung-name', label: 'Name der Veranstaltung' };

	beforeEach(() => {
		editorState.open = null;
		window.addEventListener('keydown', handleEscape);
	});

	afterEach(() => {
		window.removeEventListener('keydown', handleEscape);
	});

	async function swapIn(value: string, oncommit: (next: string) => void) {
		const mounted = render(InlineEditor, { props: { ...editor, value, oncommit } });
		await fireEvent.click(mounted.getByRole('button', { name: value }));
		return mounted;
	}

	it('swaps the row content for a labelled field and commits it on blur', async () => {
		const oncommit = vi.fn();
		const { container, getByLabelText } = await swapIn('Sommerlager', oncommit);

		const field = getByLabelText('Name der Veranstaltung');
		await expectNoAxeViolations(container);

		await fireEvent.input(field, { target: { value: 'Herbstlager' } });
		await fireEvent.blur(field);

		expect(oncommit).toHaveBeenCalledWith('Herbstlager');
	});

	it('reverts the field on Escape and hands focus back to the trigger', async () => {
		const oncommit = vi.fn();
		const { getByLabelText, getByRole } = await swapIn('Sommerlager', oncommit);
		const field = getByLabelText('Name der Veranstaltung');

		await fireEvent.input(field, { target: { value: 'Verschrieben' } });
		await fireEvent.keyDown(field, { key: 'Escape' });
		await tick();

		expect(oncommit).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(getByRole('button', { name: 'Sommerlager' }));
	});

	it('commits the open editor when another one opens', async () => {
		const oncommit = vi.fn();
		const { getByLabelText } = await swapIn('Sommerlager', oncommit);
		const field = getByLabelText('Name der Veranstaltung');
		await fireEvent.input(field, { target: { value: 'Herbstlager' } });

		const second = render(InlineEditor, {
			props: { id: 'rolle-name', label: 'Name der Rolle', value: 'Küche', oncommit: vi.fn() }
		});
		await fireEvent.click(second.getByRole('button', { name: 'Küche' }));

		expect(oncommit).toHaveBeenCalledWith('Herbstlager');
		expect(editorState.open?.id).toBe('rolle-name');
	});
});

describe('the confirm dialog', () => {
	const cascade = html('<p>Anna Meier und 3 Teilnahmen werden entfernt.</p>');

	it('opens modally with focus on Abbrechen, never on the destructive button', async () => {
		const { container, getByRole } = render(ConfirmDialog, {
			props: {
				title: 'Teilnehmer entfernen?',
				confirmLabel: 'Entfernen',
				onconfirm: vi.fn(),
				onclose: vi.fn(),
				children: cascade
			}
		});
		await tick();

		expect(document.activeElement).toBe(getByRole('button', { name: 'Abbrechen' }));
		await expectNoAxeViolations(container);
	});

	it('refuses a type-to-confirm whose name does not match, and says so on the field', async () => {
		const onconfirm = vi.fn();
		const { container, getByLabelText } = render(ConfirmDialog, {
			props: {
				title: 'Löschung einer Person',
				confirmLabel: 'Löschung',
				nameToType: 'Anna Meier',
				onconfirm,
				onclose: vi.fn(),
				children: cascade
			}
		});

		const field = getByLabelText('Zur Bestätigung den Namen eingeben');
		await fireEvent.input(field, { target: { value: 'Anna Maier' } });
		await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

		expect(onconfirm).not.toHaveBeenCalled();
		expect(field.getAttribute('aria-invalid')).toBe('true');
		await expectNoAxeViolations(container);
	});

	it('confirms once the name matches', async () => {
		const onconfirm = vi.fn();
		const { container, getByLabelText } = render(ConfirmDialog, {
			props: {
				title: 'Löschung einer Person',
				confirmLabel: 'Löschung',
				nameToType: 'Anna Meier',
				onconfirm,
				onclose: vi.fn(),
				children: cascade
			}
		});

		await fireEvent.input(getByLabelText('Zur Bestätigung den Namen eingeben'), {
			target: { value: 'Anna Meier' }
		});
		await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

		expect(onconfirm).toHaveBeenCalledOnce();
	});
});

describe('the empty states', () => {
	it('carries its action itself, so no creation path stays hidden behind it', async () => {
		const action = html('<button type="button" class="btn primary">Veranstaltung anlegen</button>');
		const { container, getByRole, getByText } = render(EmptyState, {
			props: { tier: 'nothing-yet', message: 'Noch keine Veranstaltungen.', icon: 'calendar-days', action }
		});

		expect(getByText('Noch keine Veranstaltungen.')).toBeDefined();
		expect(getByRole('button', { name: 'Veranstaltung anlegen' })).toBeDefined();
		await expectNoAxeViolations(container);
	});

	it('states what excluded everything when a filter matched nothing', async () => {
		const { container, getByText } = render(EmptyState, {
			props: { tier: 'no-matches', message: 'Keine Treffer für „Meier“.' }
		});

		expect(getByText('Keine Treffer für „Meier“.')).toBeDefined();
		await expectNoAxeViolations(container);
	});
});
