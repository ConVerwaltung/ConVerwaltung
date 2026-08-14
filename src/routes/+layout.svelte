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

	const webManifestLink = pwaInfo ? pwaInfo.webManifest.linkTag : '';

	onMount(async () => {
		bootTheme();
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({ immediate: true });
		}
		await bootLibrary();
	});
</script>

<svelte:head>
	<title>AMTS</title>
	<link rel="icon" href={favicon} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags — build-time constant from vite-plugin-pwa, not user input -->
	{@html webManifestLink}
</svelte:head>

<header>
	<h1>AMTS</h1>
</header>

<main>
	{@render children()}
</main>
