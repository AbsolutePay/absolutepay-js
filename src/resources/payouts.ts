import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Money } from "../types.js";

/** One recipient line within a batch payout. */
export interface PayoutItem {
  /** Destination on-chain wallet address to send funds to. Required. */
  recipientAddress: string;
  /** Network to send over, e.g. `"TRON"`, `"ETH"`. Must be supported for the asset — see {@link Payouts.options}. Required. */
  chain: string;
  /** Amount to send (decimal-string amount + currency), e.g. `{ amount: "25.00", currency: "USDT" }`. Required. */
  amount: Money;
  /** Optional destination memo/tag (required by some chains/exchanges, e.g. Memo/Tag networks). */
  memo?: string;
}

/** A submitted payout batch and its per-recipient sub-orders. */
export interface PayoutBatch {
  /** The batch reference id — pass to {@link Payouts.get} to poll its status. */
  merchantBatchNo: string;
  /** Overall batch status string (e.g. processing/settled/failed). */
  status: string;
  /** Per-recipient sub-order records (one per {@link PayoutItem}), passed through untyped. */
  subOrders: Array<Record<string, unknown>>;
  /** Additional provider-specific fields passed through untyped. */
  [k: string]: unknown;
}

/** A supported chain for withdrawing a given currency, with its fee and limits. */
export interface WithdrawOption {
  /** Currency/asset code this option applies to, e.g. `"USDT"`. */
  currency: string;
  /** Network the asset can be withdrawn over, e.g. `"TRON"`. */
  chain: string;
  /** Human-readable label for the chain, when provided. */
  label?: string;
  /** Fixed network withdraw fee, as a decimal string. */
  withdrawFee: string;
  /** Minimum amount per withdrawal, as a decimal string. */
  minWithdraw: string;
  /** Maximum amount per withdrawal, as a decimal string. */
  maxWithdraw: string;
  /** Block confirmations required before the withdrawal settles, when reported. */
  minConfirm?: number;
  /** Additional provider-specific fields passed through untyped. */
  [k: string]: unknown;
}

/** Send batch crypto payouts and inspect withdraw options (scopes: `payouts:write` to send, `payouts:read` to read). */
export class Payouts {
  constructor(private readonly c: Requester) {}

  /**
   * Submit a batch payout to one or more recipients (scope: `payouts:write`).
   *
   * Strongly prefer passing an `idempotencyKey`: if the call is retried (network blip,
   * timeout) the same key returns the ORIGINAL batch instead of paying a second time.
   *
   * @param params - The payout batch.
   * @param params.items - One {@link PayoutItem} per recipient. Required, non-empty.
   * @param opts - Optional request options.
   * @param opts.idempotencyKey - A unique client-generated key (e.g. a UUID) that makes the create safe to retry.
   * @returns The created {@link PayoutBatch} with its `merchantBatchNo` and sub-orders.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `payouts:write`, 422 insufficient balance, 429 rate limit).
   * @example
   * ```ts
   * const batch = await client.payouts.create(
   *   { items: [{ recipientAddress: "T...", chain: "TRON", amount: { amount: "25.00", currency: "USDT" } }] },
   *   { idempotencyKey: crypto.randomUUID() },
   * );
   * ```
   */
  create(params: { items: PayoutItem[] }, opts: { idempotencyKey?: string } = {}): Promise<PayoutBatch> {
    const headers = opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : undefined;
    return this.c.request("POST", "/v1/payouts", params, headers);
  }

  /**
   * List the chains a currency can be paid out on, with each chain's fee and min/max limits.
   * @param params - Options.
   * @param params.currency - Currency/asset code to look up, e.g. `"USDT"`. Required.
   * @returns An object with an `options` array of {@link WithdrawOption}.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `payouts:read`).
   */
  options(params: { currency: string }): Promise<{ options: WithdrawOption[] }> {
    return this.c.request("GET", `/v1/payouts/options${qs({ currency: params.currency })}`);
  }

  /**
   * Fetch a payout batch's current status (scope: `payouts:read`).
   * @param id - The batch id / `merchantBatchNo` from {@link Payouts.create}.
   * @returns The {@link PayoutBatch} with its latest status and sub-orders.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown batch, 401/403 auth).
   */
  get(id: string): Promise<PayoutBatch> {
    return this.c.request("GET", `/v1/payouts/${encodeURIComponent(id)}`);
  }
}
