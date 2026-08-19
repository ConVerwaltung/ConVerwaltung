import { cleanup } from '@testing-library/svelte';
import axe from 'axe-core';
import { afterEach } from 'vitest';

/*
	axe's colour rules are turned off for every client test, not per call site.

	Under jsdom they fail *open*: colorContrastEvaluate returns a pass for anything not
	visible on screen, and jsdom performs no layout, so every element qualifies. Leaving
	them on would make a green axe run look like a contrast guarantee it is not. The
	guarantee lives in src/lib/styles/tokens.test.ts alone.
*/
axe.configure({
	rules: axe.getRules(['cat.color']).map(({ ruleId }) => ({ id: ruleId, enabled: false }))
});

afterEach(cleanup);

/*
	jsdom has no top layer: HTMLDialogElement reflects `open` and implements nothing else,
	so a native <dialog> arrives without showModal and without close. The dialog primitive
	is deliberately native — its focus trap and Escape come from the browser — so the gap
	is filled here instead of being guarded around in the component.
*/
const dialogPrototype: Partial<HTMLDialogElement> = HTMLDialogElement.prototype;

if (dialogPrototype.showModal === undefined) {
	Object.defineProperties(HTMLDialogElement.prototype, {
		showModal: {
			configurable: true,
			value(this: HTMLDialogElement): void {
				this.open = true;
			}
		},
		close: {
			configurable: true,
			value(this: HTMLDialogElement): void {
				if (!this.open) {
					return;
				}
				this.open = false;
				this.dispatchEvent(new Event('close'));
			}
		}
	});
}
