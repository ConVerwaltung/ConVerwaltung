import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: '200.html' }),
			// Kit's default `true` sets Vite's base to './', which makes the generated
			// registration call `new Workbox('./sw.js')` — a 404 on any route of depth ≥ 2,
			// so wb.register() rejects and the update check never runs. Absolute paths also
			// match the fallback document, which always carries them (ADR-0008).
			paths: { relative: false }
		}),
		SvelteKitPWA({
			// 'prompt', not 'autoUpdate': the Import review holds a parsed file and its row
			// decisions in component state, and a reload destroys them (ADR-0008).
			registerType: 'prompt',
			kit: {
				// adapter-static writes 200.html into build/ after this plugin has globbed
				// the output, so without `spa` the precache silently lacks the fallback and
				// cold offline deep links fail.
				adapterFallback: '200.html',
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
				scope: '/',
				start_url: '/',
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
