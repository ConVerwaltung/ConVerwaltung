import { browser } from '$app/environment';

/** Absence of the data-theme attribute means 'system'; the UA then resolves the scheme. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Deliberately outside the Library: never IndexedDB, never exported, never merged. */
const STORAGE_KEY = 'amts.theme';

/** --surface in each theme, so the browser UI band continues the header with no seam. */
const THEME_COLOR = { light: '#fbfbf9', dark: '#1b2023' } as const;

export const themeState = $state({ preference: 'system' as ThemePreference });

/** Call once, in the browser, from onMount. */
export function bootTheme(): void {
	themeState.preference = readPreference();
	applyTheme(themeState.preference);
}

export function setTheme(preference: ThemePreference): void {
	themeState.preference = preference;
	writePreference(preference);
	applyTheme(preference);
}

/**
 * Runtime mirror of the inline pre-paint script in src/app.html — keep the two in sync.
 * The duplication cannot be removed: that script must run before any module loads.
 */
function applyTheme(preference: ThemePreference): void {
	const root = document.documentElement;
	if (preference === 'system') {
		root.removeAttribute('data-theme');
	} else {
		root.setAttribute('data-theme', preference);
	}
	applyThemeColorMeta(preference);
}

/** The two meta tags are media-scoped, so they follow the OS and not the override. */
function applyThemeColorMeta(preference: ThemePreference): void {
	const tags = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
	for (const tag of tags) {
		const own = tag.media.includes('dark') ? 'dark' : 'light';
		tag.content = THEME_COLOR[preference === 'system' ? own : preference];
	}
}

function readPreference(): ThemePreference {
	if (!browser) return 'system';
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored === 'light' || stored === 'dark' ? stored : 'system';
	} catch {
		// Storage access can be denied, and then localStorage throws. System default is fine.
		return 'system';
	}
}

function writePreference(preference: ThemePreference): void {
	try {
		if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, preference);
	} catch {
		// The preference simply does not persist; this session still honours it.
	}
}
