/**
 * Based on https://vitest.dev/guide/extending-matchers.html
 */
import type { HttpError, Redirect } from '@sveltejs/kit';
import 'vitest';

interface CustomMatchers<R = unknown> {
	toThrowRedirect: (expected?: {
		status?: Redirect['status'];
		location?: Redirect['location'];
	}) => R;
	toThrowHttpError: (expected?: {
		status?: HttpError['status'];
		message?: HttpError['body']['message'];
	}) => R;
}

declare module 'vitest' {
	interface Matchers<T = any> extends CustomMatchers<T> {}
}
