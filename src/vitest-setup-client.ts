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
