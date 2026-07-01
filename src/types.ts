/** A money amount as a decimal string + currency code (e.g. { amount: "10.00", currency: "USDT" }). */
export interface Money {
  amount: string;
  currency: string;
}

/** Keyset-pagination query for list endpoints. `before` is the previous page's `nextCursor`. */
export type PageQuery = {
  /** Max items per page. */
  limit?: number;
  /** Opaque cursor from the previous page's `nextCursor`. Omit for the first page. */
  before?: string;
};

/** A page of results from a keyset-paginated list endpoint. */
export interface Page<T = Record<string, unknown>> {
  items: T[];
  /**
   * Opaque keyset cursor for the NEXT page — a value the API RETURNS, not one you set.
   * To fetch the next page pass it back as the `before` query option; `null` on the last page.
   * @example "eyJpZCI6IjAxSlgwUTdBQiIsInRzIjoxNzE5NzkyMDAwMDAwfQ"
   */
  nextCursor: string | null;
}

export type PaymentType = "CHECKOUT" | "WITHDRAWAL" | "SUBSCRIPTION" | "CONVERSION" | "OFFRAMP" | "GIFTCARD";

/** A single asset balance. */
export interface Balance {
  currency: string;
  available: string;
  locked: string;
}

/** Fee preview: total fee = network base + your account-tier markup (from the pricing matrix). */
export interface FeePreview {
  amount: string;
  currency: string;
  paymentType: PaymentType;
  fee: string;
  net: string;
  markup: string;
  networkFee: string;
}
