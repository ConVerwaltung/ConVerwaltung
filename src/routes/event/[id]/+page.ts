import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

// A Veranstaltung has one daily purpose and the sidebar already names its four sections,
// so /event/<id> carries no index screen of its own.
export const load: PageLoad = ({ params }) => {
	redirect(307, resolve('/event/[id]/teilnehmer', { id: params.id }));
};
