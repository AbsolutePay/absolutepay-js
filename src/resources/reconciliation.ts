import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Page, PageQuery } from "../types.js";

/** A keyset page of settled ledger records that also carries a filtered `total` count. */
export interface ReconciliationPage extends Page {
  /** True count for the filtered range (independent of the page). */
  total?: number;
}

/** Time window + pagination for the settled-ledger reconciliation reads. */
export type ReconciliationQuery = PageQuery & {
  /** Inclusive start of the window, epoch milliseconds. */
  from?: number;
  /** Inclusive end of the window, epoch milliseconds. */
  to?: number;
};

/** Read the settled money ledgers for reconciliation against your own books (scope: `ledger:read`). */
export class Reconciliation {
  constructor(private readonly c: Requester) {}

  /**
   * List the settled pay-in ledger — collections that have completed and credited the workspace.
   * Keyset-paginated (`limit`/`before`/`order`).
   * @param query - Time window + pagination; see {@link ReconciliationQuery}.
   * @returns The raw `{ items, total, nextCursor }` — a {@link ReconciliationPage}.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `ledger:read`, 429 rate limit).
   */
  payments(query: ReconciliationQuery = {}): Promise<ReconciliationPage> {
    return this.c.request("GET", `/v1/reconciliation/payments${qs(query)}`);
  }

  /**
   * List the settled withdrawal ledger — payouts/off-ramps that have completed and debited the workspace.
   * Keyset-paginated (`limit`/`before`/`order`).
   * @param query - Time window + pagination; see {@link ReconciliationQuery}.
   * @returns The raw `{ items, total, nextCursor }` — a {@link ReconciliationPage}.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `ledger:read`, 429 rate limit).
   */
  withdrawals(query: ReconciliationQuery = {}): Promise<ReconciliationPage> {
    return this.c.request("GET", `/v1/reconciliation/withdrawals${qs(query)}`);
  }
}
