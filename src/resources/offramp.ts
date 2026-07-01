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

/** A document uploaded as base64 (e.g. a bank certificate or passport scan) for off-ramp verification. */
export interface DocFile {
  /** Original file name, e.g. `"certificate.pdf"`. Required. */
  filename: string;
  /** MIME type, e.g. `"application/pdf"` or `"image/png"`. Required. */
  contentType: string;
  /** File contents encoded as a base64 string (no data-URL prefix). Required. */
  dataBase64: string;
}

/** Inputs for registering a fiat bank account as an off-ramp destination. */
export interface BankRequest {
  /** Account holder name exactly as it appears on the bank record. Required. */
  bankAccountName: string;
  /** Name of the receiving bank. Required. */
  bankName: string;
  /** Numeric country id of the bank (from {@link OffRamp.countries}). Required. */
  countryId: number;
  /** IBAN (or local account number) of the destination account. Required. */
  iban: string;
  /** SWIFT/BIC code, when required for the corridor. Optional. */
  swift?: string;
  /** Bank/branch address, when required. Optional. */
  address?: string;
  /** Remittance line/reference number, when required. Optional. */
  remittanceLineNumber?: string;
  /** A supporting document (base64) proving ownership of the account. Required. */
  file: DocFile;
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
   * @returns The bank-accounts payload.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `payouts:read`).
   */
  banks(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/offramp/banks");
  }
  /**
   * Register a fiat bank account as an off-ramp destination (scope: `payouts:write`). Subject to manual review.
   * @param params - The bank details + a supporting document; see {@link BankRequest}.
   * @returns The registered bank `{ bankAccountId, status, ... }`.
   * @throws {AbsolutePayError} On failure (e.g. 422 invalid details, 401/403 missing `payouts:write`).
   */
  registerBank(params: BankRequest): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/offramp/banks", params);
  }
  /**
   * Delete a registered bank account (scope: `payouts:write`).
   * @param bankAccountId - Id of the bank account to remove (from {@link OffRamp.banks}).
   * @returns Nothing on success.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown bank, 401/403 missing `payouts:write`).
   */
  async deleteBank(bankAccountId: string): Promise<void> {
    await this.c.request("DELETE", `/v1/offramp/banks/${encodeURIComponent(bankAccountId)}`);
  }
  /**
   * Upload verification materials for a registered bank account (scope: `payouts:write`).
   * @param bankAccountId - Id of the bank account the documents belong to (from {@link OffRamp.banks}).
   * @param params - The verification documents (each a base64 {@link DocFile}).
   * @param params.certificate - One or more certificate documents.
   * @param params.passport - One or more passport/identity documents.
   * @returns The updated bank verification payload.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown bank, 422 invalid document, 401/403 missing `payouts:write`).
   */
  submitBankMaterials(
    bankAccountId: string,
    params: { certificate: DocFile[]; passport: DocFile[] },
  ): Promise<Record<string, unknown>> {
    return this.c.request("POST", `/v1/offramp/banks/${encodeURIComponent(bankAccountId)}/materials`, params);
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
