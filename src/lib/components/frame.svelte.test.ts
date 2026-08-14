import { createRawSnippet } from 'svelte';
import { render } from '@testing-library/svelte';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEvent } from '$lib/domain/event';
import { createEmptyLibrary, type Library } from '$lib/domain/library';
import { createParticipant } from '$lib/domain/participant';
import { createPerson } from '$lib/domain/person';
import { frameState, markUncommittedWork, noteUpdateWaiting } from '$lib/frame.svelte';
import { libraryState } from '$lib/library.svelte';
import AppHeader from './AppHeader.svelte';
import BootGate from './BootGate.svelte';
import FrameBanner from './FrameBanner.svelte';
import Sidebar from './Sidebar.svelte';

const mocked = vi.hoisted(() => ({
	page: {
		url: new URL('http://localhost/'),
		route: { id: null as string | null },
		params: {} as Record<string, string>
	}
}));

vi.mock('$app/state', () => ({ page: mocked.page }));
vi.mock('$app/paths', () => ({
	resolve: (routeId: string, params: Record<string, string> = {}) =>
		routeId.replace(/\[(\w+)\]/g, (_, name: string) => params[name])
}));

function libraryWithOneEvent(): { library: Library; eventId: string } {
	const library = createEmptyLibrary();
	const event = createEvent('Sommerlager am Krähenmoor');
	const person = createPerson('Anna Meier');
	const participant = createParticipant(event.id, person.id, []);
	library.events[event.id] = event;
	library.persons[person.id] = person;
	library.participants[participant.id] = participant;
	return { library, eventId: event.id };
}

function visit(routeId: string, pathname: string, params: Record<string, string> = {}): void {
	mocked.page.route.id = routeId;
	mocked.page.url = new URL(`http://localhost${pathname}`);
	mocked.page.params = params;
}

// The commitment is WCAG 2.2 AA; axe's best-practice rules are not part of it, and a frame
// component rendered on its own would fail them for sitting outside a landmark.
async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
	const results = await axe.run(container, {
		runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
	});
	expect(results.violations).toEqual([]);
}

describe('the app frame', () => {
	beforeEach(() => {
		libraryState.status = 'ready';
		libraryState.library = createEmptyLibrary();
		libraryState.writeFailure = null;
		libraryState.bootFailure = null;
		frameState.openEventId = null;
		frameState.updateWaiting = false;
		frameState.statusFact = '';
		frameState.uncommittedWork = null;
		visit('/', '/');
	});

	it('names the current place in the breadcrumb without making the wordmark a heading', async () => {
		const { library, eventId } = libraryWithOneEvent();
		libraryState.library = library;
		visit('/event/[id]/teilnehmer', `/event/${eventId}/teilnehmer`, { id: eventId });

		const { container, getByRole } = render(AppHeader);

		expect(getByRole('banner').textContent).toContain('Sommerlager am Krähenmoor');
		expect(container.querySelector('h1')).toBeNull();
		await expectNoAxeViolations(container);
	});

	it('marks the open place in the sidebar and counts its Teilnehmer', async () => {
		const { library, eventId } = libraryWithOneEvent();
		libraryState.library = library;
		frameState.openEventId = eventId;
		visit('/event/[id]/teilnehmer', `/event/${eventId}/teilnehmer`, { id: eventId });

		const { container, getByRole } = render(Sidebar);

		const teilnehmer = getByRole('link', { name: /Teilnehmer/ });
		expect(teilnehmer.getAttribute('aria-current')).toBe('page');
		expect(teilnehmer.textContent).toContain('1');
		await expectNoAxeViolations(container);
	});

	it('keeps the Veranstaltung group on an empty Library', async () => {
		const { container, getByText } = render(Sidebar);

		expect(getByText('Noch keine geöffnet.')).toBeDefined();
		await expectNoAxeViolations(container);
	});

	it('holds the waiting version back while a write failure stands', async () => {
		noteUpdateWaiting(async () => {});
		libraryState.writeFailure = 'QuotaExceededError: quota exceeded';

		const { container, queryByRole, getByText } = render(FrameBanner);

		expect(getByText(/Speicher nicht verfügbar/)).toBeDefined();
		expect(queryByRole('button', { name: 'Neu laden' })).toBeNull();
		await expectNoAxeViolations(container);
	});

	it('offers the reload once the failure clears', async () => {
		noteUpdateWaiting(async () => {});
		markUncommittedWork('42 entschiedene Zeilen der Import-Prüfung gehen verloren.');

		const { container, getByRole } = render(FrameBanner);

		expect(getByRole('button', { name: 'Neu laden' })).toBeDefined();
		await expectNoAxeViolations(container);
	});

	it('offers a retry after a boot failure, and names a blocking tab', async () => {
		const content = createRawSnippet(() => ({ render: () => '<p>Inhalt</p>' }));
		libraryState.status = 'error';
		libraryState.bootFailure = { blocked: true, detail: '' };

		const { container, getByRole, getByText, queryByText } = render(BootGate, {
			props: { children: content }
		});

		expect(getByText(/Eine andere Registerkarte blockiert die Aktualisierung/)).toBeDefined();
		expect(queryByText('Inhalt')).toBeNull();
		expect(getByRole('button', { name: 'Erneut versuchen' })).toBeDefined();
		await expectNoAxeViolations(container);
	});

	it('shows the technical detail of a generic boot failure', () => {
		const content = createRawSnippet(() => ({ render: () => '<p>Inhalt</p>' }));
		libraryState.status = 'error';
		libraryState.bootFailure = { blocked: false, detail: 'InvalidStateError: db closed' };

		const { getByText } = render(BootGate, { props: { children: content } });

		expect(getByText('InvalidStateError: db closed')).toBeDefined();
	});
});
