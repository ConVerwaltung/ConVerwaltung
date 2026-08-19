<script lang="ts">
	/*
		A placeholder, so the Person links the Teilnehmer register carries lead somewhere.
		The screen itself — global data, Notiz, Teilnahmen, Löschung — is designed in the
		Person ticket; nothing here is that design.
	*/
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { libraryState } from '$lib/library.svelte';

	const person = $derived(libraryState.library.persons[page.params.id ?? '']);
	const pageTitle = $derived(
		person === undefined ? 'Person nicht gefunden – AMTS' : `${person.name} – AMTS`
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#if person === undefined}
	<p>Person nicht gefunden.</p>
{:else}
	<h1>{person.name}</h1>
	<p>Die Person-Ansicht ist noch nicht gebaut.</p>
{/if}

<p><a href={resolve('/stammdaten')}>Zu den Personen</a></p>
