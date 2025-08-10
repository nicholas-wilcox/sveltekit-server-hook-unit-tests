# SvelteKit Server Hook Unit Test Demo

This repository contains a demonstration of how you can write unit tests for [SvelteKit server hooks](https://svelte.dev/docs/kit/hooks#Server-hooks).

## Motivation

In 2023, I created a SvelteKit app that involved implementing the [OpenID Connect Authorization Code Flow](https://openid.net/specs/openid-connect-basic-1_0.html#CodeFlow),
using server hooks to facilitate redirects and token verification.
Because SvelteKit's design involves throwing exceptions to signal redirects or expected errors,
I created [custom matchers](https://vitest.dev/guide/extending-matchers.html) for these objects.
These matchers were similar to [Vitest's `toThrowError` assertion](https://vitest.dev/api/expect.html#tothrowerror)
and could detect that a given hook did, in fact, throw an exception.

However, the structure of SvelteKit's module exports caused issues at the time,
and I could not easily detect what object a hook threw during a test.
I created [an issue](https://github.com/sveltejs/kit/issues/10062) describing
my dilemma and my workaround, which was to mock SvelteKit's exports.

SvelteKit v2 provides `isHttpError` and `isRedirect` functions that resolve the issue described above.
This repository and what follows below represent my current approach to unit testing server hooks.

## Getting Started

You should be able to simply clone this repository, install dependencies, and run the tests like so:

```bash
git clone https://github.com/nicholas-wilcox/sveltekit-server-hook-unit-tests.git
cd sveltekit-server-hook-unit-tests
npm install
npm run test
```

## How It Works

### Mocking Requests

Server hooks in SvelteKit are functions with two arguments, an `event` object and `resolve` callback.
In order to write unit tests for hooks, we need to create mocks for these arguments.

```ts
// src/lib/mocks/request.ts
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
    fetch: vi.fn()
    // ... other fields and methods omitted
  };
}

export function mockHandleParams() {
  return {
    event: mockRequestEvent(),
    resolve: vi.fn()
  };
}
```

### Testing a Basic Hook

The default server hook simply calls the `resolve` function with the `event` object and returns the result.
With the mocks provided above, we can create a test that a hook resolves.

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle = (async ({ event, resolve }) => {
  return resolve(event);
}) satisfies Handle;
```

```ts
// src/hooks.server.test.ts
import { describe, expect, it } from 'vitest';
import { handle } from './hooks.server';
import { mockHandleParams } from '$lib/mocks/request';

describe('handle', () => {
  it('resolves', async () => {
    let { event, resolve } = mockHandleParams();
    await handle({ event, resolve });
    expect(resolve).toHaveBeenCalled;
  });
});
```

At this point, you could also create other tests around behavior like setting cookies or response headers.

### Custom Matchers for Redirects and Errors

SvelteKit's `redirect` and `error` functions throw exceptions, but they throw specific `Redirect` and `HttpError` objects instead of `Error`s.
Therefore, we must create custom matchers using the helper functions to detect these objects. Below is a summary of how this is acheived for redirects.
The process for HTTP errors is similar.

```ts
// src/setup-tests.ts
import { isRedirect, type Redirect } from '@sveltejs/kit';
import { expect } from 'vitest';
import type { MatcherState, ExpectationResult } from '@vitest/expect';

function toThrowRedirect<T extends MatcherState = MatcherState>(
  this: T,
  actual: unknown
): ExpectationResult {
  const { isNot } = this;

  return {
    pass: isRedirect(actual),
    message: () => `Expected a redirect to ${isNot ? 'not ' : ''}be thrown`
  };
}

expect.extend({ toThrowRedirect });
```

Some notes:

- The typing for `this` is necessary because I prefer to declare the function at the top level and then provide it to `expect.extend()` below.
  I used the same typing that Vitest uses for [its `RawMatcherFn` interface](https://github.com/vitest-dev/vitest/blob/cd5c19dec1603a8bdfc4f6735bd518304cce816c/packages/expect/src/types.ts#L89).
- Because I've defined the custom matcher in a separate `src/setup-tests.ts` file, it must be configured as a [setup file](https://vitest.dev/config/#setupfiles) in the project's config.
- The `toThrowRedirect()` matcher function should be added to Vitest's `Assertion` interface using an ambient TypeScript declaration file. See [Vitest's documentation](https://vitest.dev/guide/extending-matchers.html) for more information.

Now we can create a redirect hook with a unit test.

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export const redirectHook = (async ({ event, resolve }) => {
  redirect(302, '/login');
}) satisfies Handle;
```

```ts
// src/hooks.server.test.ts
import { describe, expect, it } from 'vitest';
import { redirectHook } from './hooks.server';
import { mockHandleParams } from '$lib/mocks/request';

describe('redirectHook', () => {
  it('redirects', async () => {
    let { event, resolve } = mockHandleParams();
    await expect(redirectHook({ event, resolve })).rejects.toThrowRedirect();
  });
});
```

#### Fine-grained Redirect Assertions

What if we want to make assertions about the status code and the location of the redirect?
This can be done by enhancing our custom matcher with some optional expected values.

```ts
// src/setup-tests.ts
import { isRedirect, type Redirect } from '@sveltejs/kit';
import { expect } from 'vitest';
import type { MatcherState, ExpectationResult } from '@vitest/expect';

function toThrowRedirect<T extends MatcherState = MatcherState>(
  this: T,
  actual: unknown,
  expected?: { status?: Redirect['status']; location?: Redirect['location'] }
): ExpectationResult {
  const { isNot, equals } = this;

  const isActualRedirect = isRedirect(actual);
  if (!isActualRedirect) {
    return {
      pass: false,
      message: () => `Expected a redirect to ${isNot ? 'not ' : ''}be thrown`
    };
  }

  if (expected?.status && !equals(actual.status, expected.status)) {
    return {
      pass: false,
      message: () => 'Status code mismatch',
      actual: actual.status,
      expected: expected.status
    };
  }

  if (expected?.location && !equals(actual.location, expected.location)) {
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
```

This is arguably unnecessary, but I chose to use the [`equals()`](https://vitest.dev/guide/extending-matchers.html#equals)
function provide by `this` instead of doing my own equality checks.
You may wish to modify this code for your own purposes. For instance, when checking the message of HTTP errors,
you may want to check that the message _contains_ an expected string rather than check for equality.

In any case, we can now write tests that check the location of a redirect.

```ts
// src/hooks.server.test.ts
import { describe, expect, it } from 'vitest';
import { redirectHook } from './hooks.server';
import { mockHandleParams } from '$lib/mocks/request';

describe('redirectHook', () => {
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
```
