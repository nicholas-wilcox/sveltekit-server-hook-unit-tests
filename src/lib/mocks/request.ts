/**
 * This module provides mock objects to be used when testing server hooks.
 */
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { vi } from 'vitest';

export function mockCookies(): Cookies {
	return {
		get: vi.fn(),
		getAll: vi.fn(),
		set: vi.fn(),
		delete: vi.fn(),
		serialize: vi.fn()
	};
}

export function mockRequestEvent(): RequestEvent {
	return {
		cookies: mockCookies(),
		fetch: vi.fn(),
		getClientAddress: vi.fn(),
		locals: {},
		params: {},
		platform: undefined,
		request: new Request('http://localhost:5173'),
		route: {
			id: null
		},
		setHeaders: vi.fn(),
		url: new URL('http://localhost:5173'),
		isDataRequest: false,
		isSubRequest: false,
		isRemoteRequest: false
	};
}

export function mockHandleParams() {
	return {
		event: mockRequestEvent(),
		resolve: vi.fn()
	};
}
