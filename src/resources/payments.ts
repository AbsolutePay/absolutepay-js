import type { Requester } from "../client.js";
import type { Money } from "../types.js";

/** Parameters for creating a pay-in checkout. */
export interface CreateCheckoutParams {
  /** Amount to collect (decimal-string amount + currency), e.g. `{ amount: "10.00", currency: "USDT" }`. Required. */
  amount: Money;
  /** Settlement/receiving network for the payment, e.g. `"ETH"`, `"TRON"`, `"BSC"`. Required. */
  chain: string;
  /** Your identifier for the paying customer (integer). Required. */
  merchantUserId: number;
  /** Human-readable description of what is being purchased; shown on the checkout. Required. */
  goodsName: string;
  /** Your unique order reference. Optional; the platform generates one if omitted. Reuse it to look the checkout up later. */
  merchantTradeNo?: string;
  /** Where the payer is checking out, for UX tuning. Optional. One of `WEB`, `APP`, `WAP`, `MINIAPP`, `OTHERS`. */
  terminalType?: "WEB" | "APP" | "WAP" | "MINIAPP" | "OTHERS";
  /** Time-to-live for the checkout, in seconds. Optional; a platform default applies when omitted. */
  expiresIn?: number;
  /** Presentation mode: `"redirect"` (hosted page), `"web"` (embedded), or `"qr"` (QR code). Optional. */
  method?: "redirect" | "web" | "qr";
}

/** A created (or fetched) checkout order. Extra provider fields may be present. */
export interface Checkout {
  /** The order reference — your `merchantTradeNo` (echoed, or generated). Pass to {@link Payments.getCheckout}. */
  merchantTradeNo: string;
  /** Upstream prepay/session id for this checkout, when applicable. */
  prepayId?: string;
  /** URL to send the payer to (hosted page / redirect), when the chosen `method` yields one. */
  paymentUrl?: string;
  /** Current order status string (e.g. pending/paid), when available. */
  status?: string;
  /** Additional provider-specific fields passed through untyped. */
  [k: string]: unknown;
}

/** Create and look up pay-in checkouts / collections (scope: `payments:write`). */
export class Payments {
  constructor(private readonly c: Requester) {}

  /**
   * Create a pay-in order and get back the details/URL to collect from the customer.
   * @param params - The checkout to create; see {@link CreateCheckoutParams}.
   * @returns The created {@link Checkout} (includes `merchantTradeNo` and any `paymentUrl`).
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `payments:write`, 429 rate limit).
   * @example
   * ```ts
   * const checkout = await client.payments.createCheckout({
   *   amount: { amount: "10.00", currency: "USDT" },
   *   chain: "TRON",
   *   merchantUserId: 42,
   *   goodsName: "Pro plan",
   *   method: "redirect",
   * });
   * console.log(checkout.paymentUrl);
   * ```
   */
  createCheckout(params: CreateCheckoutParams): Promise<Checkout> {
    return this.c.request("POST", "/v1/checkout", params);
  }

  /**
   * Fetch an existing checkout's current state by its order reference.
   * @param merchantTradeNo - The order reference returned from {@link Payments.createCheckout}.
   * @returns The {@link Checkout} with its latest `status`.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown order, 401/403 auth).
   */
  getCheckout(merchantTradeNo: string): Promise<Checkout> {
    return this.c.request("GET", `/v1/checkout/${encodeURIComponent(merchantTradeNo)}`);
  }
}
