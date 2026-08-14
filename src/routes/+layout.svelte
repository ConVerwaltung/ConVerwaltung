<script lang="ts">
	import '@fontsource-variable/source-sans-3/wght.css'; // 5.3.0, OFL-1.1
	import '@fontsource-variable/inconsolata/wght.css'; // 5.3.0, OFL-1.1
	import '$lib/styles/tokens.css';
	import '$lib/styles/base.css';

	import { onMount } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';
	import favicon from '$lib/assets/favicon.svg';
	import { bootLibrary } from '$lib/library.svelte';
	import { bootTheme } from '$lib/theme.svelte';

	let { children } = $props();

	// The service worker waits instead of taking over silently, so an update never discards
	// work in progress. The banner this drives is frame work; this is the wiring only.
	let updateWaiting = $state(false);
	// Takes no argument: it tells the waiting worker to skip waiting, and the reload follows
	// from the resulting `controlling` event.
	let applyUpdate = $state<(() => Promise<void>) | undefined>(undefined);

	const webManifestLink = pwaInfo ? pwaInfo.webManifest.linkTag : '';

	onMount(async () => {
		bootTheme();
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			// On load only: the app is opened a handful of times a year and is frequently
			// offline mid-event, so an update found after boot arrives at the next boot.
			applyUpdate = registerSW({
				immediate: true,
				onNeedRefresh: () => {
					updateWaiting = true;
				},
				onRegisterError: (error) => {
					console.error('Service Worker konnte nicht registriert werden.', error);
				}
			});
		}
		await bootLibrary();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags — build-time constant from vite-plugin-pwa, not user input -->
	{@html webManifestLink}
</svelte:head>

<header>
	<h1>AMTS</h1>
	{#if updateWaiting}
		<p>
			Neue Version verfügbar
			<button type="button" onclick={() => applyUpdate?.()}>Neu laden</button>
		</p>
	{/if}
</header>

<main>
	{@render children()}
</main>
