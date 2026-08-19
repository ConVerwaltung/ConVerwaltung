/** In-memory session state of the app frame; nothing here is ever persisted. */
export const frameState = $state({
	updateWaiting: false,
	statusFact: '',
	// The sentence naming what a reload would destroy, or null when nothing is at risk.
	// The Import review is its only setter.
	uncommittedWork: null as string | null,
	// The Import review's unreadable file or unusable Zuordnung: the review cannot exist,
	// so the sentence goes in the frame's banner slot. Cleared when another file is chosen.
	fileError: null as string | null,
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

export function reportFileError(sentence: string | null): void {
	frameState.fileError = sentence;
}

export function markUncommittedWork(loss: string | null): void {
	frameState.uncommittedWork = loss;
}

export function openEvent(eventId: string): void {
	frameState.openEventId = eventId;
}
