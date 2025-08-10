import { describe, expect, it } from 'vitest';
import { handle, redirectHook, errorHook } from './hooks.server';
import { mockHandleParams } from '$lib/mocks/request';

describe('hooks', () => {
  describe('handle', () => {
    it('resolves', async () => {
      let { event, resolve } = mockHandleParams();
      await handle({ event, resolve });
      expect(resolve).toHaveBeenCalled;
    });
  });

  describe('redirectHook', () => {
    it('redirects', async () => {
      let { event, resolve } = mockHandleParams();
      await expect(redirectHook({ event, resolve })).rejects.toThrowRedirect();
    });

    it('returns a 302 status', async () => {
      let { event, resolve } = mockHandleParams();
      await expect(redirectHook({ event, resolve })).rejects.toThrowRedirect({
        status: 302
      });
    });

    it('redirects to the login route', async () => {
      let { event, resolve } = mockHandleParams();
      await expect(redirectHook({ event, resolve })).rejects.toThrowRedirect({
        location: '/login'
      });
    });
  });

  describe('errorHook', () => {
    it('errors', async () => {
      let { event, resolve } = mockHandleParams();
      await expect(errorHook({ event, resolve })).rejects.toThrowHttpError();
    });

    it('returns a 500 status', async () => {
      let { event, resolve } = mockHandleParams();
      await expect(errorHook({ event, resolve })).rejects.toThrowHttpError({
        status: 500
      });
    });

    it('returns an error message', async () => {
      let { event, resolve } = mockHandleParams();
      await expect(errorHook({ event, resolve })).rejects.toThrowHttpError({
        message: 'Server Error'
      });
    });
  });
});
