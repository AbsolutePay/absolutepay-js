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
  /** Additional provider-specific fields passed through untyped. */
  [k: string]: unknown;
}

/** A concrete deposit instruction for a payer who chose an asset/chain on a hosted invoice. */
export interface DepositOrder {
  /** Wallet address the payer must send to. */
  address: string;
  /** Exact amount to send, as a decimal string. */
  payAmount: string;
  /** Asset to send, when reported. */
  payCurrency?: string;
  /** Network to send over, when reported. */
  chain?: string;
  /** Destination memo/tag, when the chain requires one. */
  memo?: string;
  /** Deposit window expiry as epoch milliseconds, when set. */
  expireTime?: number;
  /** Additional provider-specific fields passed through untyped. */
  [k: string]: unknown;
}

/** One asset+network the payer can choose to pay a hosted invoice with. */
export interface AssetChain {
  /** Asset code, e.g. `"USDT"`. */
  currency: string;
  /** Network for that asset, e.g. `"TRON"`. */
  chain: string;
  /** Composite currency+network identifier expected by `Invoices.public.deposit()`. */
  fullCurrType: string;
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
 * Public (NO-auth) payer-facing endpoints for a hosted invoice/checkout page.
 *
 * These are keyed by the invoice `token` (not your API key) and are what a payer's
 * browser/app calls to pick an asset, get a deposit address, and poll status.
 * Accessed via {@link Invoices.public}.
 */
class PublicInvoices {
  constructor(private readonly c: Requester) {}
  /**
   * Fetch the public invoice document for the hosted page.
   * @param token - The invoice/checkout token.
   * @returns The public invoice payload.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown/expired token).
   */
  get(token: string): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/public/invoices/${encodeURIComponent(token)}`);
  }
  /**
   * List the asset/chain options the payer can pay this invoice with.
   * @param token - The invoice/checkout token.
   * @returns An array of {@link AssetChain} choices.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown token).
   */
  assets(token: string): Promise<AssetChain[]> {
    return this.c.request("GET", `/v1/public/invoices/${encodeURIComponent(token)}/assets`);
  }
  /**
   * Create a deposit order once the payer has chosen an asset/chain, yielding an address to pay.
   * @param token - The invoice/checkout token.
   * @param params - The chosen asset.
   * @param params.currency - Asset code (from {@link AssetChain.currency}).
   * @param params.chain - Network (from {@link AssetChain.chain}).
   * @param params.fullCurrType - Composite identifier (from {@link AssetChain.fullCurrType}).
   * @returns A {@link DepositOrder} with the address + exact amount.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown token, 422 unsupported asset).
   */
  deposit(token: string, params: { currency: string; chain: string; fullCurrType: string }): Promise<DepositOrder> {
    return this.c.request("POST", `/v1/public/invoices/${encodeURIComponent(token)}/deposit`, params);
  }
  /**
   * Quote how much of a chosen asset is needed to settle the invoice (FX preview).
   * @param token - The invoice/checkout token.
   * @param params - Options.
   * @param params.currency - Asset code to price the invoice in.
   * @returns The quote payload (amount in the chosen asset + rate).
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown token).
   */
  quote(token: string, params: { currency: string }): Promise<Record<string, unknown>> {
    return this.c.request("POST", `/v1/public/invoices/${encodeURIComponent(token)}/quote`, params);
  }
  /**
   * Poll the live payment status of a hosted invoice (for the payer's page).
   * @param token - The invoice/checkout token.
   * @returns The current {@link InvoiceStatus}.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown token).
   */
  status(token: string): Promise<InvoiceStatus> {
    return this.c.request("GET", `/v1/public/invoices/${encodeURIComponent(token)}/status`);
  }
}

/** Create and manage invoices + hosted payment links (scopes: `invoices:write` to mutate, `invoices:read` to list). */
export class Invoices {
  /** Public payer-facing endpoints (no API key needed) — the `PublicInvoices` sub-resource. */
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
