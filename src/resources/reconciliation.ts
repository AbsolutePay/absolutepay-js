import type { Requester } from "../client.js";
import { qs } from "../client.js";

/** Read the settled money ledgers for reconciliation against your own books (scope: `ledger:read`). */
export class Reconciliation {
  constructor(private readonly c: Requester) {}

  /**
   * List the settled pay-in ledger — collections that have completed and credited the workspace.
   *
   * Uses classic `limit`/`offset` paging (not keyset).
   *
   * @param query - Time window + paging.
   * @param query.from - Inclusive start of the window, epoch milliseconds. Optional.
   * @param query.to - Inclusive end of the window, epoch milliseconds. Optional.
   * @param query.limit - Max orders to return. Optional.
   * @param query.offset - Number of orders to skip (offset paging). Optional.
   * @returns The settled pay-in ledger `{ orders, total }`.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `ledger:read`, 429 rate limit).
   */
  payments(query: { from?: number; to?: number; limit?: number; offset?: number } = {}): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/reconciliation/payments${qs(query)}`);
  }

  /**
   * List the settled withdrawal ledger — payouts/off-ramps that have completed and debited the workspace.
   *
   * Uses classic `limit`/`offset` paging (not keyset).
   *
   * @param query - Time window + paging.
   * @param query.from - Inclusive start of the window, epoch milliseconds. Optional.
   * @param query.to - Inclusive end of the window, epoch milliseconds. Optional.
   * @param query.limit - Max sub-orders to return. Optional.
   * @param query.offset - Number of sub-orders to skip (offset paging). Optional.
   * @returns The settled withdrawal ledger `{ suborders, total }`.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `ledger:read`, 429 rate limit).
   */
  withdrawals(query: { from?: number; to?: number; limit?: number; offset?: number } = {}): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/reconciliation/withdrawals${qs(query)}`);
  }
}
