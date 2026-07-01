import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { FeePreview, PaymentType } from "../types.js";

/** Preview fees from the platform pricing matrix before committing to a payment (scope: `balances:read`). */
export class Fees {
  constructor(private readonly c: Requester) {}

  /**
   * Compute the fee (network base + your account-tier markup) for a hypothetical amount.
   * No funds move — this is a pure quote.
   *
   * @param params - Preview inputs.
   * @param params.amount - Gross amount to price, as a decimal string (e.g. `"100.00"`). Required.
   * @param params.currency - Currency/asset code of the amount (e.g. `"USDT"`). Required.
   * @param params.paymentType - Which {@link PaymentType} to price. Optional; defaults to `CHECKOUT`.
   * @returns A {@link FeePreview} with the total `fee`, `net`, `markup`, and `networkFee`.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `balances:read`).
   */
  preview(params: { amount: string; currency: string; paymentType?: PaymentType }): Promise<FeePreview> {
    return this.c.request("GET", `/v1/fees/preview${qs({ amount: params.amount, currency: params.currency, paymentType: params.paymentType })}`);
  }
}
