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
			adapter: adapter()
		}),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			workbox: {
				// Every route is prerendered and precached. The default navigation fallback
				// would answer every hard navigation with the precached '/', hydrating the
				// wrong page on e.g. /event. Serve navigations from the precache by pathname
				// instead, ignoring query parameters such as ?id=.
				navigateFallback: null,
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
