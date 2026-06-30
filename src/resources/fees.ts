import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { FeePreview, PaymentType } from "../types.js";

/** Fee preview from the platform pricing matrix (scope: balances:read). */
export class Fees {
  constructor(private readonly c: Requester) {}

  /** Preview the total fee on an amount for a payment type (default CHECKOUT). */
  preview(params: { amount: string; currency: string; paymentType?: PaymentType }): Promise<FeePreview> {
    return this.c.request("GET", `/v1/fees/preview${qs({ amount: params.amount, currency: params.currency, paymentType: params.paymentType })}`);
  }
}
