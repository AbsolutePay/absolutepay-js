import type { Requester } from "../client.js";
import { qs } from "../client.js";
import { AbsolutePayError } from "../errors.js";
import type { FeePreview, PaymentType } from "../types.js";

/** Preview the total fee before committing to a payment (scope: `balances:read`). */
export class Fees {
  constructor(private readonly c: Requester) {}

  /**
   * Compute the total fee for a hypothetical amount. No funds move — this is a pure quote.
   *
   * @param params - Preview inputs.
   * @param params.amount - Gross amount to price, as a decimal string (e.g. `"100.00"`). Required.
   * @param params.currency - Currency/asset code of the amount (e.g. `"USDT"`). Required.
   * @param params.paymentType - Which {@link PaymentType} to price. Optional; defaults to `CHECKOUT`.
   * @param params.chain - Network for the fee (e.g. `"MATIC"`). **Required** for `WITHDRAWAL`/`PAYOUT`
   *   (payout fees are per-chain); ignored for pay-in types.
   * @returns A {@link FeePreview} with the total `fee` and `net`.
   * @throws {AbsolutePayError} `chain_required` (400) if `paymentType` is `WITHDRAWAL`/`PAYOUT` and `chain`
   *   is missing; otherwise on failure (e.g. 401/403 missing `balances:read`).
   */
  preview(params: { amount: string; currency: string; paymentType?: PaymentType; chain?: string }): Promise<FeePreview> {
    if ((params.paymentType === "WITHDRAWAL" || params.paymentType === "PAYOUT") && !params.chain) {
      throw new AbsolutePayError(400, "chain_required", "a chain is required to preview a payout/withdrawal fee");
    }
    return this.c.request("GET", `/v1/fees/preview${qs({ amount: params.amount, currency: params.currency, paymentType: params.paymentType, chain: params.chain })}`);
  }
}
