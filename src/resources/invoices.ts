import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Money, Page } from "../types.js";
import type { CreateCheckoutParams, Invoice, InvoiceListQuery, InvoiceUpdate } from "./checkouts.js";

export type { Invoice, InvoiceListQuery, InvoiceStatus, InvoiceUpdate } from "./checkouts.js";

/**
 * Parameters for creating an invoice. Identical to a checkout but **`chain` is required** —
 * the deposit address is minted up front for that network (the response is an
 * {@link InvoiceCreated} with the address, not a hosted-link URL).
 */
export interface CreateInvoiceParams extends CreateCheckoutParams {
  /** Network to mint the deposit address on, e.g. `"TRON"` (from `deposits.chains()`). Required. */
  chain: string;
}

/** A created invoice with its up-front deposit address. Extra fields may be present. */
export interface InvoiceCreated {
  /** Public `/pay/<token>` link id — used to update/void it and read its status. */
  token: string;
  /** On-chain deposit address to receive payment. */
  address: string;
  /** Destination tag/memo — present for memo chains (TON, etc.); sending without it can lose funds. */
  memo?: string;
  /** Network the deposit address is on. */
  chain: string;
  /** The token the payer should send. */
  currency: string;
  /** Exact amount the payer should send, as a decimal string. */
  amount: string;
  /** Expiry as epoch milliseconds, when set. */
  expireTime?: number;
  /** Return URL echoed back when supplied on create. */
  redirectUrl?: string;
  /** Additional fields passed through untyped. */
  [k: string]: unknown;
}

/**
 * Create and manage invoices — the up-front fixed-address flow (scopes: `invoices:write` to
 * mutate, `invoices:read` to read). For a payer-picks hosted link, use `client.checkouts`.
 */
export class Invoices {
  constructor(private readonly c: Requester) {}

  /**
   * Create an invoice, minting the deposit address up front (scope: `invoices:write`).
   * @param params - The invoice to create; **`chain` is required**. See {@link CreateInvoiceParams}.
   * @returns The created {@link InvoiceCreated} (includes `token`, `address`, `chain`, `amount`).
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `invoices:write`, 409 duplicate `reference`).
   * @example
   * ```ts
   * const invoice = await client.invoices.create({
   *   reference: "inv_2024_0007",
   *   amount: { amount: "49.00", currency: "USDT" },
   *   chain: "TRON",
   * });
   * console.log(invoice.address);
   * ```
   */
  create(params: CreateInvoiceParams): Promise<InvoiceCreated> {
    return this.c.request("POST", "/v1/invoices", params);
  }

  /**
   * List invoices, newest first (scope: `invoices:read`). Keyset-paginated.
   * @param query - Filters + pagination; pass a prior page's `nextCursor` as `before`.
   * @returns The raw `{ items, nextCursor }` page of {@link Invoice} records.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `invoices:read`).
   */
  list(query: InvoiceListQuery = {}): Promise<Page<Invoice>> {
    return this.c.request("GET", `/v1/invoices${qs(query)}`);
  }

  /**
   * Fetch a single invoice by its token (scope: `invoices:read`).
   * @param token - The invoice `token`.
   * @returns The {@link Invoice} record.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown token).
   */
  get(token: string): Promise<Invoice> {
    return this.c.request("GET", `/v1/invoices/${encodeURIComponent(token)}`);
  }

  /**
   * Update an invoice (pause/resume, change redirect/expiry/description) (scope: `invoices:write`).
   * @param token - The invoice `token`.
   * @param patch - Partial update; omit a field to leave it, send `null` to clear it. See {@link InvoiceUpdate}.
   * @returns The updated {@link Invoice}.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown token, 401/403 auth).
   */
  update(token: string, patch: InvoiceUpdate): Promise<Invoice> {
    return this.c.request("PATCH", `/v1/invoices/${encodeURIComponent(token)}`, patch);
  }

  /**
   * Void an invoice so it can no longer be paid (scope: `invoices:write`).
   * @param token - The invoice `token`.
   * @returns `{ ok: true }` on success.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown token, 409 already paid).
   */
  del(token: string): Promise<{ ok: boolean }> {
    return this.c.request("DELETE", `/v1/invoices/${encodeURIComponent(token)}`);
  }
}
