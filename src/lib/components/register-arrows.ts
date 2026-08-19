import type { Action } from 'svelte/action';

const CONTROLS =
	'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)';

/*
	Controls whose own arrow behaviour is the point: a radio group chooses within itself,
	a select opens its list, a textarea moves the caret. The register layer stays out of
	their way, which it can afford to because nothing may ever depend on it.
*/
function keepsItsOwnArrows(element: Element): boolean {
	if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
		return true;
	}
	return element instanceof HTMLInputElement && ['radio', 'range', 'number'].includes(element.type);
}

function controlsOf(row: Element): HTMLElement[] {
	return Array.from(row.querySelectorAll<HTMLElement>(CONTROLS));
}

/*
	The corresponding control is the one at the same position in a neighbouring row. Rows
	that do not reach that position are stepped over, so an expanded detail row between two
	register rows does not swallow the move.
*/
function correspondingControl(row: Element, position: number, step: number): HTMLElement | null {
	let neighbour = step < 0 ? row.previousElementSibling : row.nextElementSibling;
	while (neighbour !== null) {
		const controls = controlsOf(neighbour);
		if (controls.length > position) {
			return controls[position];
		}
		neighbour = step < 0 ? neighbour.previousElementSibling : neighbour.nextElementSibling;
	}
	return null;
}

function moveBetweenRows(event: KeyboardEvent): void {
	if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
		return;
	}
	const source = event.target as HTMLElement;
	if (keepsItsOwnArrows(source)) {
		return;
	}
	const row = source.closest('tr');
	if (row === null) {
		return;
	}
	const position = controlsOf(row).indexOf(source);
	if (position === -1) {
		return;
	}
	const neighbour = correspondingControl(row, position, event.key === 'ArrowDown' ? 1 : -1);
	if (neighbour === null) {
		return;
	}
	event.preventDefault();
	neighbour.focus();
}

/*
	Additive by construction: a screen reader's browse mode swallows arrows before the page
	sees them, so for AT users this layer silently does not exist. It is attached as a
	listener rather than as an event attribute because the table itself is not interactive —
	the layer only ever moves focus between controls that are already reachable by Tab.
*/
export const arrowLayer: Action<HTMLElement> = (node) => {
	node.addEventListener('keydown', moveBetweenRows);
	return {
		destroy: () => {
			node.removeEventListener('keydown', moveBetweenRows);
		}
	};
};
