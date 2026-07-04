import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Money, Page, PageQuery } from "../types.js";

/** Lifecycle status of a hosted checkout or invoice link. */
export type InvoiceStatus = "OPEN" | "PAID" | "EXPIRED" | "VOID";

/** Parameters for creating a hosted checkout link (payer picks the asset/chain on the page). */
export interface CreateCheckoutParams {
  /** Your order/reference shown to the payer (reconciliation handle). Required. */
  reference: string;
  /** Amount to bill (decimal-string amount + currency), e.g. `{ amount: "49.00", currency: "USDT" }`. Required. */
  amount: Money;
  /** Optional description shown to the payer / stored on the link. */
  description?: string;
  /** Optional payer email (for receipts / notifications). */
  customerEmail?: string;
  /** Optional link expiry as epoch milliseconds; past it the link reads `EXPIRED` and won't accept payment. */
  expiresAt?: number;
  /**
   * Optional http(s) URL the payer is redirected to once the checkout reaches a terminal state.
   * The browser is returned with `?token=<token>&status=<PAID|EXPIRED|VOID>` appended.
   */
  redirectUrl?: string;
}

/** A created hosted checkout link — the page to send the payer to. Extra fields may be present. */
export interface CheckoutLink {
  /** Opaque link token — used in the hosted `/pay/<token>` URL and to {@link Checkouts.get} it. */
  token: string;
  /** Full hosted checkout URL (when a checkout base URL is configured). */
  checkoutUrl?: string;
  /** Relative `/pay/<token>` path (when no base URL is configured). */
  payPath?: string;
  /** Current {@link InvoiceStatus} of the link. */
  status: InvoiceStatus;
  /** Expiry as epoch milliseconds, when set. */
  expiresAt?: number;
  /** Additional fields passed through untyped. */
  [k: string]: unknown;
}

/**
 * A checkout/invoice record as returned by list/get/update.
 *
 * `null` on a patch field clears it; omit a field on update to leave it unchanged.
 * Extra fields may be present.
 */
export interface Invoice {
  /** Public `/pay/<token>` link id. */
  token: string;
  /** Which manager owns it: a billed `invoice` or a shareable `checkout` link. */
  kind?: "invoice" | "checkout";
  /** Display merchant name. */
  merchantName: string;
  /** Your order/reference. */
  reference: string;
  /** Billed amount (decimal-string amount + currency). */
  amount: Money;
  /** Description, when set. */
  description?: string;
  /** Payer email, when set on create. */
  customerEmail?: string;
  /** Current {@link InvoiceStatus}. */
  status: InvoiceStatus;
  /** On-chain transaction id once paid, when available. */
  txId?: string;
  /** Additional fields passed through untyped. */
  [k: string]: unknown;
}

/**
 * PATCH body for a checkout/invoice — every field optional. Omit a field to leave it
 * unchanged; send `null` to CLEAR it (`redirectUrl`/`expiresAt`/`description`).
 */
export interface InvoiceUpdate {
  /** Live/paused — a paused link won't accept payment. */
  paused?: boolean;
  /** http(s) merchant return URL, or `null` to clear. */
  redirectUrl?: string | null;
  /** Link expiry (epoch ms), or `null` to clear. */
  expiresAt?: number | null;
  /** Free-text description, or `null` to clear. */
  description?: string | null;
}

/** Filters + pagination accepted by checkout/invoice `list`. */
export type InvoiceListQuery = PageQuery & {
  /** Filter by {@link InvoiceStatus}. */
  status?: InvoiceStatus;
  /** Free-text search over reference/description/email. */
  q?: string;
};

/**
 * Create and manage hosted checkout links where the payer picks the asset/chain on the page
 * (scopes: `invoices:write` to mutate, `invoices:read` to read). For an up-front fixed-address
 * flow, use {@link "../resources/invoices".Invoices} instead.
 */
export class Checkouts {
  constructor(private readonly c: Requester) {}

  /**
   * Create a hosted checkout link (scope: `invoices:write`).
   * @param params - The checkout to create; see {@link CreateCheckoutParams}.
   * @returns A {@link CheckoutLink} with the hosted `checkoutUrl`/`payPath` and `token`.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `invoices:write`).
   * @example
   * ```ts
   * const link = await client.checkouts.create({
   *   reference: "order_1001",
   *   amount: { amount: "49.00", currency: "USDT" },
   * });
   * console.log(link.checkoutUrl);
   * ```
   */
  create(params: CreateCheckoutParams): Promise<CheckoutLink> {
    return this.c.request("POST", "/v1/checkouts", params);
  }

  /**
   * List checkout links, newest first (scope: `invoices:read`). Keyset-paginated.
   * @param query - Filters + pagination; pass a prior page's `nextCursor` as `before`.
   * @returns The raw `{ items, nextCursor }` page of {@link Invoice} records.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `invoices:read`).
   */
  list(query: InvoiceListQuery = {}): Promise<Page<Invoice>> {
    return this.c.request("GET", `/v1/checkouts${qs(query)}`);
  }

  /**
   * Fetch a single checkout by its token (scope: `invoices:read`).
   * @param token - The checkout `token` from {@link CheckoutLink.token}.
   * @returns The {@link Invoice} record.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown token).
   */
  get(token: string): Promise<Invoice> {
    return this.c.request("GET", `/v1/checkouts/${encodeURIComponent(token)}`);
  }

  /**
   * Update a checkout (pause/resume, change redirect/expiry/description) (scope: `invoices:write`).
   * @param token - The checkout `token`.
   * @param patch - Partial update; omit a field to leave it, send `null` to clear it. See {@link InvoiceUpdate}.
   * @returns The updated {@link Invoice}.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown token, 401/403 auth).
   */
  update(token: string, patch: InvoiceUpdate): Promise<Invoice> {
    return this.c.request("PATCH", `/v1/checkouts/${encodeURIComponent(token)}`, patch);
  }

  /**
   * Void a checkout so it can no longer be paid (scope: `invoices:write`).
   * @param token - The checkout `token`.
   * @returns `{ ok: true }` on success.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown token, 409 already paid).
   */
  del(token: string): Promise<{ ok: boolean }> {
    return this.c.request("DELETE", `/v1/checkouts/${encodeURIComponent(token)}`);
  }
}
