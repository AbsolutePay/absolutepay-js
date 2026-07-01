/**
 * A money amount, expressed as a decimal STRING plus a currency code.
 *
 * Amounts are always strings (never JavaScript numbers/floats) to avoid binary
 * floating-point rounding on financial values — pass `"10.00"`, not `10`.
 *
 * @example
 * ```ts
 * const price: Money = { amount: "10.00", currency: "USDT" };
 * ```
 */
export interface Money {
  /** Decimal-string amount, e.g. `"10.00"` or `"0.5"`. Never a number. */
  amount: string;
  /** Uppercase currency/asset code, e.g. `"USDT"`, `"USDC"`, `"BTC"`. */
  currency: string;
}

/**
 * Query options for a keyset-paginated list endpoint.
 *
 * Pagination is cursor-based: request a page size with {@link PageQuery.limit},
 * then feed the response's {@link Page.nextCursor} back in as {@link PageQuery.before}
 * to walk forward. Do not construct or parse the cursor yourself — treat it as opaque.
 */
export type PageQuery = {
  /** Maximum number of items to return in the page. Optional; the API applies a default/max when omitted. */
  limit?: number;
  /**
   * Opaque cursor identifying where the next page starts — pass the previous page's
   * {@link Page.nextCursor} here. Omit (or pass `undefined`) to fetch the first page.
   */
  before?: string;
};

/**
 * One page of results from a keyset-paginated list endpoint.
 *
 * @typeParam T - The element type of {@link Page.items}.
 */
export interface Page<T = Record<string, unknown>> {
  /** The items on this page, in the endpoint's default sort order. */
  items: T[];
  /**
   * Opaque keyset cursor for the NEXT page — a value the API RETURNS, not one you set.
   * To fetch the next page pass it back as the {@link PageQuery.before} query option.
   * `null` when this is the last page (no more results).
   * @example "eyJpZCI6IjAxSlgwUTdBQiIsInRzIjoxNzE5NzkyMDAwMDAwfQ"
   */
  nextCursor: string | null;
}

/**
 * The kind of payment a fee preview or ledger entry applies to. Each maps to a
 * distinct pricing row in the platform's fee matrix.
 *
 * - `CHECKOUT` — inbound pay-in / hosted checkout collection.
 * - `WITHDRAWAL` — crypto payout / withdrawal.
 * - `SUBSCRIPTION` — recurring subscription deduction.
 * - `CONVERSION` — asset-to-asset conversion.
 * - `OFFRAMP` — crypto → fiat off-ramp to a bank account.
 * - `GIFTCARD` — gift-card issuance.
 */
export type PaymentType = "CHECKOUT" | "WITHDRAWAL" | "SUBSCRIPTION" | "CONVERSION" | "OFFRAMP" | "GIFTCARD";

/** A single asset's balance within the workspace. */
export interface Balance {
  /** Uppercase asset code this balance is denominated in, e.g. `"USDT"`. */
  currency: string;
  /** Spendable balance as a decimal string, e.g. `"125.50"`. */
  available: string;
  /** Funds held/reserved (pending settlements, in-flight payouts) as a decimal string. */
  locked: string;
}

/**
 * A fee quote for a prospective payment. The total {@link FeePreview.fee} is the
 * network base cost plus your account-tier markup, taken from the platform pricing matrix.
 */
export interface FeePreview {
  /** The gross amount the fee was computed on, as a decimal string (echoes the request). */
  amount: string;
  /** Currency/asset code of {@link FeePreview.amount}, e.g. `"USDT"`. */
  currency: string;
  /** Which payment type this preview priced — see {@link PaymentType}. */
  paymentType: PaymentType;
  /** Total fee charged (network base + markup), as a decimal string. */
  fee: string;
  /** Amount that nets out after the fee (`amount - fee`), as a decimal string. */
  net: string;
  /** Your account-tier margin portion of the fee, as a decimal string. */
  markup: string;
  /** The underlying network/base fee portion, as a decimal string. */
  networkFee: string;
}
