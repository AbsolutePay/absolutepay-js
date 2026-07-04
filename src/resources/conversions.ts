import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { IdempotencyOptions, Money } from "../types.js";
import { idempotencyHeaders } from "../types.js";
import type { LedgerPage, LedgerQuery } from "./refunds.js";

/** Inputs for requesting a conversion quote. Specify EXACTLY ONE of `sellAmount` / `buyAmount`. */
export interface QuoteParams {
  /** Asset you are converting FROM, e.g. `"USDT"`. Required. */
  sellCurrency: string;
  /** Asset you are converting TO, e.g. `"USDC"`. Required. */
  buyCurrency: string;
  /** Fixed amount of `sellCurrency` to spend, as a decimal string. Specify exactly one of `sellAmount` / `buyAmount`. */
  sellAmount?: string;
  /** Fixed amount of `buyCurrency` to receive, as a decimal string. Specify exactly one of `sellAmount` / `buyAmount`. */
  buyAmount?: string;
}

/** A firm (short-lived) conversion quote. Execute it before it expires by passing `quoteId` back. */
export interface ConvertQuote {
  /** Opaque quote id to pass to {@link Conversions.execute}. Time-limited. */
  quoteId: string;
  /** Exchange rate (sell → buy) locked by this quote, as a decimal string. */
  rate: string;
  /** Asset being sold. */
  sellCurrency: string;
  /** Exact amount of `sellCurrency` that will be debited, as a decimal string. */
  sellAmount: string;
  /** Asset being bought. */
  buyCurrency: string;
  /** Exact amount of `buyCurrency` that will be credited, as a decimal string. */
  buyAmount: string;
}

/** The result of executing a conversion. Extra provider fields may be present. */
export interface ConvertOrder {
  /** The conversion order number. */
  orderId: string;
  /** Terminal/interim status: `"SUCCESS"`, `"FAILED"`, or `"PENDING"`. */
  status: "SUCCESS" | "FAILED" | "PENDING";
  /** Exact sell {@link Money} debited. */
  sell?: Money;
  /** Exact buy {@link Money} credited. */
  buy?: Money;
  /** Additional provider-specific fields passed through untyped. */
  [k: string]: unknown;
}

/** Convert between stablecoins/crypto assets (scope: `convert:write`). */
export class Conversions {
  constructor(private readonly c: Requester) {}

  /**
   * Get a firm, short-lived conversion quote. No funds move.
   * @param params - What to convert; see {@link QuoteParams} (specify exactly one of `sellAmount`/`buyAmount`).
   * @returns A {@link ConvertQuote} with a `quoteId`, locked `rate`, and both exact amounts.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `convert:write`, 422 unsupported pair).
   */
  quote(params: QuoteParams): Promise<ConvertQuote> {
    return this.c.request("POST", "/v1/conversions/quote", params);
  }

  /**
   * Execute a conversion against a quote you already obtained from {@link Conversions.quote}.
   * @param params - Execution inputs.
   * @param params.quoteId - The `quoteId` from the quote. Required, and must not have expired.
   * @param params.sell - The exact sell {@link Money} from the quote (`sellAmount` + `sellCurrency`).
   * @param params.buy - The exact buy {@link Money} from the quote (`buyAmount` + `buyCurrency`).
   * @param opts - Optional `{ idempotencyKey }` — retrying with the same key + body replays the original.
   * @returns The resulting {@link ConvertOrder}.
   * @throws {AbsolutePayError} On failure (e.g. 409/422 expired or mismatched quote, 401/403 auth).
   * @example
   * ```ts
   * const q = await client.conversions.quote({ sellCurrency: "USDT", buyCurrency: "USDC", sellAmount: "100.00" });
   * const order = await client.conversions.execute(
   *   { quoteId: q.quoteId, sell: { amount: q.sellAmount, currency: q.sellCurrency }, buy: { amount: q.buyAmount, currency: q.buyCurrency } },
   *   { idempotencyKey: crypto.randomUUID() },
   * );
   * ```
   */
  execute(params: { quoteId: string; sell: Money; buy: Money }, opts: IdempotencyOptions = {}): Promise<ConvertOrder> {
    return this.c.request("POST", "/v1/conversions", params, idempotencyHeaders(opts));
  }

  /**
   * List the settled CONVERT ledger history (scope: `convert:read`). Keyset-paginated.
   * @param query - Time window + asset filter + pagination; see {@link LedgerQuery}.
   * @returns The raw `{ items, total, nextCursor }` — a {@link LedgerPage}.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 auth).
   */
  list(query: LedgerQuery = {}): Promise<LedgerPage> {
    return this.c.request("GET", `/v1/conversions${qs(query)}`);
  }
}
