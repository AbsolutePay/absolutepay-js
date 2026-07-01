import type { Requester } from "../client.js";

/** Parameters for refunding a settled collection. */
export interface CreateRefundParams {
  /** Order reference of the original checkout/collection being refunded. Required. */
  merchantTradeNo: string;
  /** Amount to refund (decimal-string amount + currency). Supports partial refunds up to the collected total. Required. */
  amount: { amount: string; currency: string };
  /** Optional free-text reason recorded with the refund. */
  reason?: string;
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

/** Issue and track refunds on settled collections (scope: `payments:write`). */
export class Refunds {
  constructor(private readonly c: Requester) {}

  /**
   * Refund all or part of a previously settled collection.
   * @param params - The refund to create; see {@link CreateRefundParams}.
   * @returns The created {@link Refund} with its `refundRequestId` and status.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `payments:write`, 422 over-refund, 404 unknown order).
   * @example
   * ```ts
   * const refund = await client.refunds.create({
   *   merchantTradeNo: "order_123",
   *   amount: { amount: "10.00", currency: "USDT" },
   *   reason: "customer request",
   * });
   * ```
   */
  create(params: CreateRefundParams): Promise<Refund> {
    return this.c.request("POST", "/v1/refunds", params);
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
}
