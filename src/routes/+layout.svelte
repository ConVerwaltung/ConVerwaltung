<script lang="ts">
	import '@fontsource-variable/source-sans-3/wght.css'; // 5.3.0, OFL-1.1
	import '@fontsource-variable/inconsolata/wght.css'; // 5.3.0, OFL-1.1
	import '$lib/styles/tokens.css';
	import '$lib/styles/base.css';

	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { pwaInfo } from 'virtual:pwa-info';
	import favicon from '$lib/assets/favicon.svg';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import BootGate from '$lib/components/BootGate.svelte';
	import FrameBanner from '$lib/components/FrameBanner.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { handleEscape } from '$lib/editor.svelte';
	import { noteUpdateWaiting, openEvent } from '$lib/frame.svelte';
	import { bootLibrary, libraryState } from '$lib/library.svelte';
	import { bootTheme } from '$lib/theme.svelte';

	let { children } = $props();

	const webManifestLink = pwaInfo ? pwaInfo.webManifest.linkTag : '';

	// The service worker waits instead of taking over silently, so an update never discards
	// work in progress; the banner offers the reload once it is waiting.
	async function registerServiceWorker(): Promise<void> {
		if (!pwaInfo) {
			return;
		}
		const { registerSW } = await import('virtual:pwa-register');
		// On load only: the app is opened a handful of times a year and is frequently
		// offline mid-event, so an update found after boot arrives at the next boot.
		const applyUpdate = registerSW({
			immediate: true,
			onNeedRefresh: () => noteUpdateWaiting(applyUpdate),
			onRegisterError: (error) => {
				console.error('Service Worker konnte nicht registriert werden.', error);
			}
		});
	}

	onMount(async () => {
		bootTheme();
		await registerServiceWorker();
		await bootLibrary();
	});

	// The sidebar keeps the last-opened Veranstaltung after leaving it, for this session only.
	$effect(() => {
		const eventId = page.params.id ?? '';
		if (page.route.id?.startsWith('/event/[id]') && eventId !== '') {
			openEvent(eventId);
		}
	});
</script>

<!-- Escape has one meaning and one implementation, next to the editor state it acts on;
     no screen carries a handler of its own. -->
<svelte:window onkeydown={handleEscape} />

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags — build-time constant from vite-plugin-pwa, not user input -->
	{@html webManifestLink}
	<!-- Each screen sets its own title; until one renders there is only the app's name. -->
	{#if libraryState.status !== 'ready'}
		<title>AMTS</title>
	{/if}
</svelte:head>

<AppHeader />
<Sidebar />

<div class="content">
	<FrameBanner />
	<main id="inhalt" tabindex="-1">
		<BootGate>{@render children()}</BootGate>
	</main>
</div>

<style>
	.content {
		margin-top: var(--frame-h);
		margin-left: var(--sidebar-w);
	}

	main {
		max-width: var(--sheet-max);
		padding: var(--space-6) var(--space-6) var(--space-8);
	}
</style>
