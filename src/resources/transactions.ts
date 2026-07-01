import type { Requester } from "../client.js";
import { qs } from "../client.js";

/** Unified funds ledger (scope: ledger:read). */
export class Transactions {
  constructor(private readonly c: Requester) {}

  /** List ledger entries. Filter with `from`/`to` (epoch ms); page with `limit`/`offset`. `format=csv` for an export. */
  list(
    query: { from?: number; to?: number; limit?: number; offset?: number; currency?: string; format?: "json" | "csv" } = {},
  ): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/transactions${qs(query)}`);
  }
}
