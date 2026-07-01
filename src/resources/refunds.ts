import type { Requester } from "../client.js";

export interface CreateRefundParams {
  merchantTradeNo: string;
  amount: { amount: string; currency: string };
  reason?: string;
}

export interface Refund {
  merchantTradeNo: string;
  /** The refund's id — pass to `refunds.get()`. */
  refundRequestId: string;
  status: string;
  amount: string;
  currency: string;
  [k: string]: unknown;
}

/** Refunds on settled collections (scope: payments:write). */
export class Refunds {
  constructor(private readonly c: Requester) {}

  create(params: CreateRefundParams): Promise<Refund> {
    return this.c.request("POST", "/v1/refunds", params);
  }

  get(id: string): Promise<Refund> {
    return this.c.request("GET", `/v1/refunds/${encodeURIComponent(id)}`);
  }
}
