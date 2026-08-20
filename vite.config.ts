import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

// GitHub Pages serves this repo as a project site under /<repo>/, so the build needs a base
// path; the deploy workflow sets BASE_PATH. Empty everywhere else — dev server, Vitest and a
// local `npm run build` all run at the origin root.
function readBasePath(): '' | `/${string}` {
	const value = process.env.BASE_PATH ?? '';
	if (value === '') return '';
	// Kit's own rule, enforced here so a mistyped workflow value fails the build instead of
	// producing a site whose every asset URL is subtly wrong.
	if (!value.startsWith('/') || value.endsWith('/')) {
		throw new Error(`BASE_PATH must start with '/' and must not end with one; got '${value}'`);
	}
	return value as `/${string}`;
}

const base = readBasePath();

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// '404.html', not '200.html': GitHub Pages has no rewrite rule and answers every
			// unknown path with the repository's 404 document (ADR-0008, Amendment 2026-08-20).
			adapter: adapter({ fallback: '404.html' }),
			// Kit's default `true` sets Vite's base to './', which makes the generated
			// registration call `new Workbox('./sw.js')` — a 404 on any route of depth ≥ 2,
			// so wb.register() rejects and the update check never runs. Absolute paths also
			// match the fallback document, which always carries them (ADR-0008).
			paths: { base, relative: false }
		}),
		SvelteKitPWA({
			// 'prompt', not 'autoUpdate': the Import review holds a parsed file and its row
			// decisions in component state, and a reload destroys them (ADR-0008).
			registerType: 'prompt',
			kit: {
				// adapter-static writes 404.html into build/ after this plugin has globbed
				// the output, so without `spa` the precache silently lacks the fallback and
				// cold offline deep links fail.
				adapterFallback: '404.html',
				spa: true
			},
			workbox: {
				// 'prompt' sets neither skipWaiting nor clientsClaim; without clientsClaim a
				// first install stays online-only until relaunch. The split is deliberate —
				// see ADR-0008, Amendment 2026-08-13.
				clientsClaim: true,
				// Precache routes are registered before the navigation fallback and match by
				// exact URL, so the prerendered routes keep serving their own documents; the
				// dynamic subtrees land on 200.html.
				ignoreURLParametersMatching: [/./]
			},
			manifest: {
				name: 'AMTS',
				short_name: 'AMTS',
				description: 'Adaptives Teilnehmer-Management-System',
				lang: 'de',
				// --surface and --paper, light. A manifest cannot be theme-aware
					// (color_scheme_dark is unsupported and absent from the plugin's types), so a
					// dark-mode organizer gets one light splash frame. Accepted; no mechanism exists.
					theme_color: '#fbfbf9',
				background_color: '#f1f2ee',
				display: 'standalone',
				// Both carry the base path: an installed PWA launches at the app root and its
				// scope must cover it, and neither is derived from Vite's base once set by hand.
				scope: `${base}/`,
				start_url: `${base}/`,
				icons: [
					{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'pwa-512x512-maskable.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				// Scoped a11y smoke tests only — the registers, the dialog, the Import
				// decision group and the app frame. Not a snapshot suite over every component.
				extends: './vite.config.ts',
				// Without the browser condition Svelte resolves to its server build, where
				// mounting a component throws instead of producing DOM to check.
				resolve: { conditions: ['browser'] },
				test: {
					name: 'client',
					environment: 'jsdom',
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./src/vitest-setup-client.ts']
				}
			}
		]
	}
});
