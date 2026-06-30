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
  chain: string;
  fee?: string;
  minAmount?: string;
  maxAmount?: string;
  [k: string]: unknown;
}

/** Batch crypto payouts (scopes: payouts:write / payouts:read). */
export class Payouts {
  constructor(private readonly c: Requester) {}

  /** Submit a batch payout. Pass an idempotency key to make retries safe. */
  create(params: { items: PayoutItem[] }): Promise<PayoutBatch> {
    return this.c.request("POST", "/v1/payouts", params);
  }

  /** Supported chains + per-chain withdraw fee/limits for a currency. */
  options(params: { currency: string }): Promise<WithdrawOption[]> {
    return this.c.request("GET", `/v1/payouts/options${qs({ currency: params.currency })}`);
  }

  /** Look up a payout batch by id. */
  get(id: string): Promise<PayoutBatch> {
    return this.c.request("GET", `/v1/payouts/${encodeURIComponent(id)}`);
  }
}
