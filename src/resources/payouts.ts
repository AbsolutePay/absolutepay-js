import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Money } from "../types.js";

export interface PayoutItem {
  recipientAddress: string;
  chain: string;
  amount: Money;
  memo?: string;
}

export interface PayoutBatch {
  merchantBatchNo: string;
  status: string;
  subOrders: Array<Record<string, unknown>>;
  [k: string]: unknown;
}

export interface WithdrawOption {
  currency: string;
  chain: string;
  label?: string;
  withdrawFee: string;
  minWithdraw: string;
  maxWithdraw: string;
  minConfirm?: number;
  [k: string]: unknown;
}

/** Batch crypto payouts (scopes: payouts:write / payouts:read). */
export class Payouts {
  constructor(private readonly c: Requester) {}

  /**
   * Submit a batch payout. Pass `idempotencyKey` to make retries safe — the same key
   * returns the original batch instead of paying twice.
   */
  create(params: { items: PayoutItem[] }, opts: { idempotencyKey?: string } = {}): Promise<PayoutBatch> {
    const headers = opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : undefined;
    return this.c.request("POST", "/v1/payouts", params, headers);
  }

  /** Supported chains + per-chain withdraw fee/limits for a currency. */
  options(params: { currency: string }): Promise<{ options: WithdrawOption[] }> {
    return this.c.request("GET", `/v1/payouts/options${qs({ currency: params.currency })}`);
  }

  /** Look up a payout batch by id. */
  get(id: string): Promise<PayoutBatch> {
    return this.c.request("GET", `/v1/payouts/${encodeURIComponent(id)}`);
  }
}
