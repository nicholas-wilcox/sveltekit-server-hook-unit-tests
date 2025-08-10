/**
 * This module provides custom matcher functions used to make assertions
 * about `Redirect` and `HttpError` thrown by SvelteKit's utility functions.
 */
import { isHttpError, isRedirect, type HttpError, type Redirect } from '@sveltejs/kit';
import { expect } from 'vitest';
import type { MatcherState } from '@vitest/expect';

function toThrowRedirect<T extends MatcherState = MatcherState>(
  this: T,
  actual: unknown,
  expected?: { status?: Redirect['status']; location?: Redirect['location'] }
) {
  const { isNot } = this;

  const isActualRedirect = isRedirect(actual);
  if (!isActualRedirect) {
    return {
      pass: false,
      message: () => `Expected a redirect to ${isNot ? 'not ' : ''}be thrown`
    };
  }

  if (expected?.status && actual.status !== expected.status) {
    return {
      pass: false,
      message: () => 'Status code mismatch',
      actual: actual.status,
      expected: expected.status
    };
  }

  if (expected?.location && actual.location !== expected.location) {
    return {
      pass: false,
      message: () => 'Location mismatch',
      actual: actual.location,
      expected: expected.location
    };
  }

  return {
    pass: true,
    message: () => `Expected a redirect to ${isNot ? 'not ' : ''}be thrown`
  };
}

function toThrowHttpError<T extends MatcherState = MatcherState>(
  this: T,
  actual: unknown,
  expected?: { status?: HttpError['status']; message?: HttpError['body']['message'] }
) {
  const { isNot } = this;

  const isActualHttpError = isHttpError(actual);
  if (!isActualHttpError) {
    return {
      pass: false,
      message: () => `Expected an HTTP error to ${isNot ? 'not ' : ''}be thrown`
    };
  }

  if (expected?.status && actual.status !== expected.status) {
    return {
      pass: false,
      message: () => 'Status code mismatch',
      actual: actual.status,
      expected: expected.status
    };
  }

  if (expected?.message && actual.body.message !== expected.message) {
    return {
      pass: false,
      message: () => 'Message mismatch',
      actual: actual.body.message,
      expected: expected.message
    };
  }

  return {
    pass: true,
    message: () => `Expected an HTTP error to ${isNot ? 'not ' : ''}be thrown`
  };
}

expect.extend({
  toThrowRedirect,
  toThrowHttpError
});
