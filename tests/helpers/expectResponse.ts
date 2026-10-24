/**
 * expectResponse — helper for synchronizing a test on a specific tRPC network response.
 *
 * Why this exists:
 * The "arm waitForResponse → perform action → await the promise" dance was copy-pasted
 * into almost every test, differing only by endpoint and status code:
 *
 *   const responsePromise = page.waitForResponse(
 *     (resp) => resp.url().includes('/api/trpc/auth.login') && resp.status() === 200
 *   );
 *   await loginPage.login(email, password);
 *   await responsePromise;
 *
 * Repeating that ~30 times is noise that buries the intent of each test and invites
 * subtle copy-paste errors (wrong status, wrong endpoint). This helper collapses it
 * into a single expressive call.
 *
 * Why the action is passed as a callback (not called before this helper):
 * Ordering matters. waitForResponse must be armed BEFORE the action fires, otherwise
 * a fast response can arrive before the listener is attached and the wait hangs until
 * timeout. Taking the action as a callback lets the helper guarantee the correct order
 * internally — the caller can't accidentally get it wrong.
 *
 * On coupling to route names (deliberate tradeoff):
 * This still synchronizes on an internal tRPC path, which the user never sees — the
 * same brittleness noted in routes.ts. It's kept because some assertions genuinely need
 * to wait for a mutation to complete on the server before checking persisted state
 * (e.g. reload + verify DB value). For purely visual outcomes, prefer asserting on the
 * user-visible result (error text, redirect) with web-first assertions instead of this.
 *
 * Why the status is ASSERTED, not used as a match filter:
 * Filtering on `resp.status() === status` means a response with the wrong status is
 * simply ignored — the wait then hangs for the full timeout and the failure reads as
 * "Timeout waiting for response" instead of "expected 200, received 500". Matching on
 * the route only and asserting the status afterwards fails fast, at the right line,
 * with the real status in the message.
 *
 * Why Promise.all instead of "arm, await action, await promise":
 * If the action throws (element not found, navigation aborted), a dangling
 * waitForResponse promise would reject later on page close as an unhandled rejection.
 * Promise.all arms the listener synchronously before the action starts AND settles
 * both together — the idiomatic Playwright form of this pattern.
 *
 * Usage:
 *   import { expectResponse } from '../helpers/expectResponse';
 *   import { ROUTES } from '../helpers/routes';
 *
 *   await expectResponse(page, ROUTES.auth.login, 200, () =>
 *     loginPage.login(email, password)
 *   );
 */

import { expect, type Page, type Response } from '@playwright/test';
import { matchesRoute } from './routes';

/**
 * Wait for a tRPC response matching `route` and `status` that occurs as a result
 * of running `action`.
 *
 * @param page   - Playwright Page the response is expected on
 * @param route  - tRPC route to match exactly via matchesRoute() — use ROUTES.* constants
 * @param status - expected HTTP status code (e.g. 200 for success, 400 for validation error);
 *                 asserted on the first response for `route`, see the note above
 * @param action - the action that triggers the request (click, fill+submit, goto, ...)
 * @returns the matched Response — callers that need the body can inspect it
 */
export async function expectResponse(
  page: Page,
  route: string,
  status: number,
  action: () => Promise<unknown>
): Promise<Response> {
  /* waitForResponse is called (and its listener attached) before action() starts —
   * array elements are evaluated left to right. */
  const [response] = await Promise.all([
    page.waitForResponse((resp) => matchesRoute(resp.url(), route)),
    action(),
  ]);

  expect(response.status(), `HTTP status of ${route}`).toBe(status);

  return response;
}
