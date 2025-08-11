# SvelteKit Server Hook Unit Test Demo

This repository contains a demonstration of how you can write unit tests for [SvelteKit server hooks](https://svelte.dev/docs/kit/hooks#Server-hooks). It focuses on testing `Redirect` and `HttpError` objects thrown by SvelteKit's utility functions, which is also useful when unit testing server load functions.

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
    // ...other fields and methods omitted
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

### Testing Redirects and Errors

SvelteKit's `redirect` and `error` functions throw exceptions, but they throw specific `Redirect` and `HttpError` objects instead of `Error`s.
Therefore, we must use the [`rejects`](https://vitest.dev/api/expect.html#rejects) property to access the thrown object.

Suppose we have the following redirect hook:

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export const redirectHook = (async ({ event, resolve }) => {
  redirect(302, '/login');
}) satisfies Handle;
```

In [a comment](https://github.com/sveltejs/kit/issues/10062#issuecomment-3172921484) on my original GitHub issue, user @rebasecase suggested combining SvelteKit's `isRedirect()` and `isHttpError()` functions with Vitest's builtin `toSatisfy()` assertion. We can use the following test to confirm that the redirect is thrown:

```ts
// src/hooks.server.test.ts
import { describe, expect, it } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { redirectHook } from './hooks.server';
import { mockHandleParams } from '$lib/mocks/request';

describe('redirectHook', () => {
  it('redirects', async () => {
    let { event, resolve } = mockHandleParams();
    await expect(redirectHook({ event, resolve })).rejects.toSatisfy(isRedirect);
  });
});
```

We can also pass our own function that accepts the thrown value as an argument to perform other checks.

```ts
it('redirects to the login page', async () => {
  let { event, resolve } = mockHandleParams();
  await expect(redirectHook({ event, resolve })).rejects.toSatisfy((e) => {
    return isRedirect(e) && e.location === '/login';
  });
});
```

This approach will let you test any criteria you want, but it comes with some caveats:

1. It is a potential source of code duplication.
2. Consequently, your tests may develop subtle differences in how they inspect data.
3. The reporting for a failed test is not granular.

### Custom Matchers

We can create our own assertion functions, or "matchers", that abstract the process of calling `isRedirect()`
while integrating with Vitest's reporting functionality.

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

expect.extend({ toThrowRedirect });
```

Some notes:

- The typing for `this` is necessary because I prefer to declare the function at the top level and then provide it to `expect.extend()` below.
  I used the same typing that Vitest uses for [its `RawMatcherFn` interface](https://github.com/vitest-dev/vitest/blob/cd5c19dec1603a8bdfc4f6735bd518304cce816c/packages/expect/src/types.ts#L89).
- I chose to use the [`equals()`](https://vitest.dev/guide/extending-matchers.html#equals) function provide by `this` instead of doing my own equality checks.
  You may wish to modify this code to fit your preferences.
- Because I've defined the custom matcher in a separate `src/setup-tests.ts` file, it must be configured as a [setup file](https://vitest.dev/config/#setupfiles) in the project's config.
- The `toThrowRedirect()` matcher function should be added to Vitest's `Assertion` interface using an ambient TypeScript declaration file. See [Vitest's documentation](https://vitest.dev/guide/extending-matchers.html) for more information.

Now we can rewrite the previous redirect tests using a `toThrowRedirect()` function.

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

  it('redirects to the login page', async () => {
    let { event, resolve } = mockHandleParams();
    await expect(redirectHook({ event, resolve })).rejects.toThrowRedirect({ location: '/login' });
  });
});
```

### A Note on Types

TypeScript can (sometimes) recognize that `actual`
has the `Redirect` type when it checks the `status` and `location` fields.
This is because the return type of SvelteKit's `isRedirect()` function ([source link](https://github.com/sveltejs/kit/blob/6275ef3376789ddeccac038165260d98513fa0c0/packages/kit/src/exports/index.js#L124))
is actually a [_type predicate_](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates).

Because we return early when `isRedirect(actual)` is `false`, TypeScript assumes that `actual`
has the `Redirect` type in the code below, which only runs when `isRedirect(actual)` returns `true`.
The `isHttpError()` function similarly returns a type predicate related to the `HttpError` type.

## Next Steps and Disclaimers

I hope you find this code useful enough for to customize for your own needs.
A realistic application will have specific behavior that is contingent on the `event` object's data, like its route ID.
You will likely want to modify the mock utility library to easily create mock events that represent the scenarios you want to test.

I should also note that there is no inherent link between server hooks and SvelteKit's `redirect()` and `error()` functions.
These functions can be used in other places like server load functions, and so the custom matchers shown here can be used to perform unit tests on that code as well.

Additionally, I have omitted SvelteKit's `fail` function from this demo, but the same principles
should apply if you wish to create unit tests around expected errors in your form actions.
