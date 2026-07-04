import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { IdempotencyOptions, Money, Page } from "../types.js";
import { idempotencyHeaders } from "../types.js";

/** Parameters for refunding a settled collection. */
export interface CreateRefundParams {
  /** Order reference of the original checkout/collection being refunded. Required. */
  merchantTradeNo: string;
  /** Amount to refund (decimal-string amount + currency). Supports partial refunds up to the collected total. Required. */
  amount: Money;
  /** Optional free-text reason recorded with the refund. */
  reason?: string;
  /** Optional client-supplied refund id (idempotency handle within the order). */
  refundRequestId?: string;
}

/** A refund request and its status. Extra provider fields may be present. */
export interface Refund {
  /** Order reference of the collection that was refunded. */
  merchantTradeNo: string;
  /** The refund's id — pass to {@link Refunds.get} to poll its status. */
  refundRequestId: string;
  /** Current refund status string (e.g. pending/processing/refunded/failed). */
  status: string;
  /** Refund amount as a decimal string. */
  amount: string;
  /** Currency/asset code of the refund. */
  currency: string;
  /** Additional provider-specific fields passed through untyped. */
  [k: string]: unknown;
}

/** One settled ledger entry (a row in the refund/conversion history). */
export interface LedgerEntry {
  /** Stable record id. */
  recordId: string;
  /** Settlement time, unix ms. */
  ts: number;
  /** Asset code, e.g. `"USDT"`. */
  currency: string;
  /** Signed balance change as a decimal string (negative = debit). */
  change: string;
  /** Ledger entry type, e.g. `"REFUND"` / `"CONVERT"`. */
  type: string;
  /** Reference back to the originating order/operation. */
  ref?: string;
  /** Additional fields passed through untyped. */
  [k: string]: unknown;
}

/** A page of ledger history that also carries a filtered `total` count. */
export interface LedgerPage extends Page<LedgerEntry> {
  /** True count for the filtered range (independent of the page). */
  total?: number;
}

/** Filters + pagination for the settled ledger history endpoints. */
export type LedgerQuery = {
  /** Inclusive start of the window, epoch milliseconds. */
  from?: number;
  /** Inclusive end of the window, epoch milliseconds. */
  to?: number;
  /** Restrict to a single asset code, e.g. `"USDT"`. */
  currency?: string;
  /** Max items per page. */
  limit?: number;
  /** Cursor from the previous page's `nextCursor`. */
  before?: string;
  /** Sort direction, `"asc"` | `"desc"`. */
  order?: "asc" | "desc";
};

/** Issue and track refunds on settled collections (scope: `payments:write`). */
export class Refunds {
  constructor(private readonly c: Requester) {}

  /**
   * Refund all or part of a previously settled collection.
   * @param params - The refund to create; see {@link CreateRefundParams}.
   * @param opts - Optional `{ idempotencyKey }` — retrying with the same key + body replays the original.
   * @returns The created {@link Refund} with its `refundRequestId` and status.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `payments:write`, 422 over-refund, 404 unknown order, 409 idempotency conflict).
   * @example
   * ```ts
   * const refund = await client.refunds.create(
   *   { merchantTradeNo: "order_123", amount: { amount: "10.00", currency: "USDT" }, reason: "customer request" },
   *   { idempotencyKey: crypto.randomUUID() },
   * );
   * ```
   */
  create(params: CreateRefundParams, opts: IdempotencyOptions = {}): Promise<Refund> {
    return this.c.request("POST", "/v1/refunds", params, idempotencyHeaders(opts));
  }

  /**
   * Fetch a refund's current status.
   * @param id - The `refundRequestId` returned by {@link Refunds.create}.
   * @returns The {@link Refund} with its latest status.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown refund, 401/403 auth).
   */
  get(id: string): Promise<Refund> {
    return this.c.request("GET", `/v1/refunds/${encodeURIComponent(id)}`);
  }

  /**
   * List the settled REFUND ledger history (scope: `payments:read`). Keyset-paginated.
   * @param query - Time window + asset filter + pagination; see {@link LedgerQuery}.
   * @returns The raw `{ items, total, nextCursor }` — a {@link LedgerPage} of {@link LedgerEntry}.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 auth).
   */
  list(query: LedgerQuery = {}): Promise<LedgerPage> {
    return this.c.request("GET", `/v1/refunds${qs(query)}`);
  }
}
