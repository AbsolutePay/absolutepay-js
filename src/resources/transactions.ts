import type { Requester } from "../client.js";
import { qs } from "../client.js";

/** Unified funds ledger (scope: ledger:read). */
export class Transactions {
  constructor(private readonly c: Requester) {}

  /** List ledger entries, optionally filtered by time range / paginated. */
  list(query: { startTime?: number; endTime?: number; page?: number; count?: number } = {}): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/transactions${qs(query)}`);
  }
}
