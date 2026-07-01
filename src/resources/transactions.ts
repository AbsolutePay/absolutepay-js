import type { Requester } from "../client.js";
import { qs } from "../client.js";

/** Read the unified funds ledger for reconciliation and exports (scope: `ledger:read`). */
export class Transactions {
  constructor(private readonly c: Requester) {}

  /**
   * List ledger entries across every money movement (pay-ins, payouts, conversions, fees, …).
   *
   * Unlike the keyset-paginated list endpoints, this ledger uses classic `limit`/`offset` paging.
   *
   * @param query - Filters + paging.
   * @param query.from - Inclusive start of the time window, epoch milliseconds. Optional.
   * @param query.to - Inclusive end of the time window, epoch milliseconds. Optional.
   * @param query.limit - Max entries to return. Optional.
   * @param query.offset - Number of entries to skip (offset paging). Optional.
   * @param query.currency - Restrict to a single asset code, e.g. `"USDT"`. Optional.
   * @param query.format - `"json"` (default) for a data payload, or `"csv"` to get a CSV export. Optional.
   * @returns The ledger payload (JSON entries, or CSV text when `format="csv"`).
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `ledger:read`, 429 rate limit).
   */
  list(
    query: { from?: number; to?: number; limit?: number; offset?: number; currency?: string; format?: "json" | "csv" } = {},
  ): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/transactions${qs(query)}`);
  }
}
