import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Money } from "../types.js";

export interface CreateInvoiceParams {
  reference: string;
  amount: Money;
  description?: string;
  customerEmail?: string;
  expiresAt?: number;
  /** when set, mint the deposit address up front for this network (invoice flow). */
  chain?: string;
}

export interface CheckoutLink {
  token: string;
  /** Hosted page URL to send the payer to. */
  checkoutUrl?: string;
  payPath?: string;
  status: string;
  expiresAt?: number;
  [k: string]: unknown;
}

export interface InvoiceCreated {
  token: string;
  address?: string;
  chain?: string;
  currency?: string;
  amount?: string;
  expireTime?: number;
  [k: string]: unknown;
}

export interface DepositOrder {
  address: string;
  payAmount: string;
  payCurrency?: string;
  chain?: string;
  memo?: string;
  expireTime?: number;
  [k: string]: unknown;
}

export interface AssetChain {
  currency: string;
  chain: string;
  fullCurrType: string;
}

export interface InvoiceStatus {
  status: string;
  phase?: string;
  txId?: string;
  [k: string]: unknown;
}

/** Public (no-auth) payer endpoints for a hosted invoice/checkout page. */
class PublicInvoices {
  constructor(private readonly c: Requester) {}
  get(token: string): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/public/invoices/${encodeURIComponent(token)}`);
  }
  assets(token: string): Promise<AssetChain[]> {
    return this.c.request("GET", `/v1/public/invoices/${encodeURIComponent(token)}/assets`);
  }
  deposit(token: string, params: { currency: string; chain: string; fullCurrType: string }): Promise<DepositOrder> {
    return this.c.request("POST", `/v1/public/invoices/${encodeURIComponent(token)}/deposit`, params);
  }
  quote(token: string, params: { currency: string }): Promise<Record<string, unknown>> {
    return this.c.request("POST", `/v1/public/invoices/${encodeURIComponent(token)}/quote`, params);
  }
  status(token: string): Promise<InvoiceStatus> {
    return this.c.request("GET", `/v1/public/invoices/${encodeURIComponent(token)}/status`);
  }
}

/** Invoices + hosted payment links (scopes: invoices:write / invoices:read). */
export class Invoices {
  /** Public payer-facing endpoints (no API key needed). */
  readonly public: PublicInvoices;
  constructor(private readonly c: Requester) {
    this.public = new PublicInvoices(c);
  }

  /** Create an invoice; pass `chain` to mint the deposit address up front. */
  create(params: CreateInvoiceParams): Promise<InvoiceCreated> {
    return this.c.request("POST", "/v1/invoices", params);
  }

  /** Create a hosted checkout link (the payer picks the asset on the page). */
  createCheckout(params: Omit<CreateInvoiceParams, "chain">): Promise<CheckoutLink> {
    return this.c.request("POST", "/v1/checkouts", params);
  }

  list(query: { limit?: number; status?: string } = {}): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/invoices${qs(query)}`);
  }

  stats(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/invoices/stats");
  }

  pause(token: string, params: { paused: boolean }): Promise<{ ok: true }> {
    return this.c.request("POST", `/v1/invoices/${encodeURIComponent(token)}/pause`, params);
  }

  void(token: string): Promise<{ ok: true }> {
    return this.c.request("POST", `/v1/invoices/${encodeURIComponent(token)}/void`);
  }
}
