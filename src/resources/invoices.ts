import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Money, Page, PageQuery } from "../types.js";

/** Parameters for creating an invoice or hosted checkout link. */
export interface CreateInvoiceParams {
  /** Your unique reference for this invoice (idempotency / reconciliation handle). Required. */
  reference: string;
  /** Amount to bill (decimal-string amount + currency), e.g. `{ amount: "49.00", currency: "USDT" }`. Required. */
  amount: Money;
  /** Optional description shown to the payer / stored on the invoice. */
  description?: string;
  /** Optional payer email (for receipts / notifications). */
  customerEmail?: string;
  /** Optional expiry as epoch milliseconds; after this the invoice can no longer be paid. */
  expiresAt?: number;
  /** When set, mint the deposit address up front for this network (fixed-asset invoice flow), e.g. `"TRON"`. Omit to let the payer pick the asset. */
  chain?: string;
  /**
   * Optional http(s) URL to return the payer to once the hosted checkout reaches a terminal state.
   * The browser is redirected with `?token=<invoiceToken>&status=<SUCCESS|EXPIRED|CANCELED>` appended
   * (any existing query on the URL is preserved).
   */
  redirectUrl?: string;
}

/** A created hosted checkout link (payer picks the asset on the page). Extra fields may be present. */
export interface CheckoutLink {
  /** Opaque invoice/checkout token — used in the public payer endpoints and hosted URL. */
  token: string;
  /** Hosted page URL to send the payer to. */
  checkoutUrl?: string;
  /** Relative hosted path (alternative to {@link CheckoutLink.checkoutUrl}), when returned. */
  payPath?: string;
  /** Current status string of the checkout. */
  status: string;
  /** Expiry as epoch milliseconds, when set. */
  expiresAt?: number;
  /** Additional provider-specific fields passed through untyped. */
  [k: string]: unknown;
}

/** A created invoice. If `chain` was supplied, a deposit `address` is included. Extra fields may be present. */
export interface InvoiceCreated {
  /** Opaque invoice token — used to pause/void it and in the public payer endpoints. */
  token: string;
  /** Deposit address, present only when the invoice was created with a fixed `chain`. */
  address?: string;
  /** Network the deposit address is on, when an address was minted. */
  chain?: string;
  /** Asset the payer should send, when fixed. */
  currency?: string;
  /** Amount the payer should send, as a decimal string, when fixed. */
  amount?: string;
  /** Expiry as epoch milliseconds, when set. */
  expireTime?: number;
  /** Return URL echoed back when supplied on create — where the payer is sent after the checkout reaches a terminal state. */
  redirectUrl?: string;
  /** Additional provider-specific fields passed through untyped. */
  [k: string]: unknown;
}

/** Live status of a hosted invoice/deposit. Extra fields may be present. */
export interface InvoiceStatus {
  /** Current status string (e.g. open/paid/expired). */
  status: string;
  /** Finer-grained lifecycle phase, when reported. */
  phase?: string;
  /** On-chain transaction id once a payment is detected. */
  txId?: string;
  /** Additional provider-specific fields passed through untyped. */
  [k: string]: unknown;
}

/**
 * Public (NO-auth) payer-facing endpoint for a hosted invoice/checkout page.
 *
 * Keyed by the invoice `token` (not your API key). This is the recommended
 * settlement-confirmation fallback to the `payment.succeeded` webhook — poll it
 * to observe when a hosted checkout reaches a terminal state.
 * Accessed via {@link Invoices.public}.
 */
class PublicInvoices {
  constructor(private readonly c: Requester) {}
  /**
   * Poll the live payment status of a hosted invoice.
   * @param token - The invoice/checkout token (from {@link CheckoutLink.token}).
   * @returns The current {@link InvoiceStatus}.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown token).
   */
  status(token: string): Promise<InvoiceStatus> {
    return this.c.request("GET", `/v1/public/invoices/${encodeURIComponent(token)}/status`);
  }
  /**
   * Record a hosted-page open (best-effort analytics beacon; increments the link's open count).
   * @param token - The invoice/checkout token (from {@link CheckoutLink.token}).
   */
  async trackOpen(token: string): Promise<void> {
    await this.c.request("POST", `/v1/public/invoices/${encodeURIComponent(token)}/open`);
  }
}

/** Create and manage invoices + hosted payment links (scopes: `invoices:write` to mutate, `invoices:read` to list). */
export class Invoices {
  /** Public payer-facing endpoint (no API key needed) — the `PublicInvoices` sub-resource (`public.status`). */
  readonly public: PublicInvoices;
  constructor(private readonly c: Requester) {
    this.public = new PublicInvoices(c);
  }

  /**
   * Create an invoice (scope: `invoices:write`).
   * @param params - The invoice to create; pass `chain` to mint the deposit address up front, or omit it to let the payer choose.
   * @returns The created {@link InvoiceCreated} (includes `token`, and `address` when `chain` was set).
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `invoices:write`, 409 duplicate `reference`).
   * @example
   * ```ts
   * const invoice = await client.invoices.create({
   *   reference: "inv_2024_0007",
   *   amount: { amount: "49.00", currency: "USDT" },
   *   customerEmail: "buyer@example.com",
   * });
   * ```
   */
  create(params: CreateInvoiceParams): Promise<InvoiceCreated> {
    return this.c.request("POST", "/v1/invoices", params);
  }

  /**
   * Create a hosted checkout link where the payer picks the asset on the page (scope: `invoices:write`).
   * @param params - Same as {@link CreateInvoiceParams} but WITHOUT `chain` (the payer chooses the asset).
   * @returns A {@link CheckoutLink} with the hosted `checkoutUrl`.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `invoices:write`).
   */
  createCheckout(params: Omit<CreateInvoiceParams, "chain">): Promise<CheckoutLink> {
    return this.c.request("POST", "/v1/checkouts", params);
  }

  /**
   * List invoices, newest first (scope: `invoices:read`). Keyset-paginated.
   * @param query - Filters + pagination. Pass a prior page's {@link Page.nextCursor} as `before` for the next page.
   * @param query.status - Optional status filter (e.g. `"open"`, `"paid"`).
   * @param query.kind - Optional kind filter.
   * @param query.limit - Max items per page.
   * @param query.before - Cursor from the previous page.
   * @returns A {@link Page} of invoice records; `nextCursor` is `null` on the last page.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `invoices:read`).
   */
  list(query: PageQuery & { status?: string; kind?: string } = {}): Promise<Page> {
    return this.c.request("GET", `/v1/invoices${qs(query)}`);
  }

  /**
   * Aggregate invoice statistics for the workspace (counts/totals).
   * @returns The stats payload.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `invoices:read`).
   */
  stats(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/invoices/stats");
  }

  /**
   * Pause or resume an invoice (scope: `invoices:write`).
   * @param token - The invoice token from {@link InvoiceCreated.token}.
   * @param params - Options.
   * @param params.paused - `true` to pause (block payment), `false` to resume.
   * @returns `{ ok: true }` on success.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown invoice, 401/403 auth).
   */
  pause(token: string, params: { paused: boolean }): Promise<{ ok: true }> {
    return this.c.request("POST", `/v1/invoices/${encodeURIComponent(token)}/pause`, params);
  }

  /**
   * Void an invoice so it can no longer be paid (scope: `invoices:write`). Irreversible.
   * @param token - The invoice token from {@link InvoiceCreated.token}.
   * @returns `{ ok: true }` on success.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown invoice, 409 already paid).
   */
  void(token: string): Promise<{ ok: true }> {
    return this.c.request("POST", `/v1/invoices/${encodeURIComponent(token)}/void`);
  }
}
