/** In-memory session state of the app frame; nothing here is ever persisted. */
export const frameState = $state({
	updateWaiting: false,
	statusFact: '',
	// The sentence naming what a reload would destroy, or null when nothing is at risk.
	// The Import review is its only setter.
	uncommittedWork: null as string | null,
	openEventId: null as string | null
});

let skipWaiting: (() => Promise<void>) | undefined;

export function noteUpdateWaiting(applyUpdate: () => Promise<void>): void {
	skipWaiting = applyUpdate;
	frameState.updateWaiting = true;
}

export function reloadForUpdate(): void {
	void skipWaiting?.();
}

export function announce(fact: string): void {
	frameState.statusFact = fact;
}

export function markUncommittedWork(loss: string | null): void {
	frameState.uncommittedWork = loss;
}

export function openEvent(eventId: string): void {
	frameState.openEventId = eventId;
}
