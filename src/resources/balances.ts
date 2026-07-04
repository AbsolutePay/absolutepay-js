import type { Requester } from "../client.js";
import type { Balance, Page } from "../types.js";

/** Read the workspace's asset balances (scope: `balances:read`). */
export class Balances {
  constructor(private readonly c: Requester) {}

  /**
   * List every asset balance held by the workspace.
   * @returns The raw `{ items, nextCursor }` (nextCursor always `null`) of {@link Balance} (available + locked per currency).
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `balances:read`, 429 rate limit).
   * @example
   * ```ts
   * const { items } = await client.balances.list();
   * for (const b of items) console.log(b.currency, b.available);
   * ```
   */
  list(): Promise<Page<Balance>> {
    return this.c.request("GET", "/v1/balances");
  }
}
