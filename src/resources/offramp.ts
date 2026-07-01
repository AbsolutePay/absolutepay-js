import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Page, PageQuery } from "../types.js";

/** Inputs for an off-ramp (crypto → fiat) quote. */
export interface OffRampQuoteParams {
  /** Crypto asset to sell, e.g. `"USDT"`. Required. */
  cryptoCurrency: string;
  /** Fiat currency to receive, e.g. `"USD"`, `"EUR"`. Required. */
  fiatCurrency: string;
  /** Amount of crypto to sell, as a decimal string. Required. */
  cryptoAmount: string;
}

/** Inputs for executing an off-ramp withdrawal against a quote. */
export interface OffRampWithdrawParams {
  /** The quote token returned by {@link OffRamp.quote}. Time-limited. Required. */
  quoteToken: string;
  /** Id of the destination bank account (from {@link OffRamp.banks}). Required. */
  bankAccountId: string;
  /** Crypto asset being sold (must match the quote). Required. */
  cryptoCurrency: string;
  /** Fiat currency being received (must match the quote). Required. */
  fiatCurrency: string;
  /** Crypto amount being sold (must match the quote), as a decimal string. Required. */
  cryptoAmount: string;
  /** Fiat amount to be received (from the quote), as a decimal string. Required. */
  fiatAmount: string;
}

/** Convert crypto to fiat and pay out to a bank account (scopes: `payouts:write` to withdraw, `payouts:read` to read). */
export class OffRamp {
  constructor(private readonly c: Requester) {}

  /**
   * List supported off-ramp destination countries.
   * @returns The countries payload.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `payouts:read`).
   */
  countries(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/offramp/countries");
  }
  /**
   * List the workspace's registered bank accounts (use an id as {@link OffRampWithdrawParams.bankAccountId}).
   *
   * Note: registering a NEW bank account is a multipart upload and is not yet wrapped by this SDK.
   * @returns The bank-accounts payload.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `payouts:read`).
   */
  banks(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/offramp/banks");
  }
  /**
   * Get a firm off-ramp quote (crypto amount → fiat amount + rate/fees). No funds move.
   * @param params - What to sell; see {@link OffRampQuoteParams}.
   * @returns The quote payload (includes a `quoteToken` to pass to {@link OffRamp.withdraw}).
   * @throws {AbsolutePayError} On failure (e.g. 422 below minimum, 401/403 auth).
   */
  quote(params: OffRampQuoteParams): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/offramp/quote", params);
  }
  /**
   * Execute an off-ramp withdrawal against a quote, settling fiat to a bank account (scope: `payouts:write`).
   * @param params - The withdrawal; see {@link OffRampWithdrawParams}. Amounts must match the quote.
   * @returns The created off-ramp order payload.
   * @throws {AbsolutePayError} On failure (e.g. 409/422 expired quote, 422 insufficient balance, 401/403 auth).
   */
  withdraw(params: OffRampWithdrawParams): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/offramp/withdraw", params);
  }
  /**
   * List off-ramp orders (scope: `payouts:read`). Keyset-paginated.
   * @param query - Filters + pagination. Pass a prior page's {@link Page.nextCursor} as `before`.
   * @param query.status - Optional status filter.
   * @param query.limit - Max items per page.
   * @param query.before - Cursor from the previous page.
   * @returns A {@link Page} of off-ramp order records; `nextCursor` is `null` on the last page.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `payouts:read`).
   */
  orders(query: PageQuery & { status?: string } = {}): Promise<Page> {
    return this.c.request("GET", `/v1/offramp/orders${qs(query)}`);
  }
}
