// src/routes/+page.server.ts
import { posts } from '$lib/posts';
import { postDates } from '$lib/dates';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		posts,
		postDates
	};
};
