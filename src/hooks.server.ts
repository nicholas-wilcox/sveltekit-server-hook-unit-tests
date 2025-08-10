/**
 * This module contains simple server hooks that use SvelteKit's utility
 * functions for managing redirects and expected server errors.
 */
import type { Handle } from '@sveltejs/kit';
import { redirect, error } from '@sveltejs/kit';

export const redirectHook = (async ({ event, resolve }) => {
  redirect(302, '/login');
}) satisfies Handle;

export const errorHook = (async ({ event, resolve }) => {
  error(500, 'Server Error');
}) satisfies Handle;
