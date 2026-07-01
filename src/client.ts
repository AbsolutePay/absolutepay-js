import { AbsolutePayError } from "./errors.js";
import { signRequest } from "./signing.js";
import { Balances } from "./resources/balances.js";
import { Fees } from "./resources/fees.js";
import { Payments } from "./resources/payments.js";
import { Payouts } from "./resources/payouts.js";
import { Refunds } from "./resources/refunds.js";
import { Conversions } from "./resources/conversions.js";
import { Invoices } from "./resources/invoices.js";
import { Subscriptions } from "./resources/subscriptions.js";
import { GiftCards } from "./resources/giftcards.js";
import { OffRamp } from "./resources/offramp.js";
import { Transactions } from "./resources/transactions.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/** The transport a resource needs — lets resources stay decoupled from the concrete client (testable). */
export interface Requester {
  request<T>(method: HttpMethod, path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
}

export interface AbsolutePayConfig {
  /** App API key (Bearer). Server-side only — never ship it to a browser. */
  apiKey: string;
  /** Request signing secret (`apisign_…`). Required for app keys: every request is HMAC-signed. */
  signingSecret?: string;
  /**
   * Target the AbsolutePay **sandbox** (`https://sandbox-api.absolutepay.io`) instead of production.
   * Default `false` → production (`https://api.absolutepay.io`). Ignored when `baseUrl` is set.
   */
  sandbox?: boolean;
  /** Override the API origin entirely (e.g. a self-hosted gateway). Takes precedence over `sandbox`. */
  baseUrl?: string;
  /** Per-request timeout (ms). Default 30000. */
  timeoutMs?: number;
  /** Injectable fetch (tests / custom agents). Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
}

/** The only public API origins. Anything else must be passed explicitly via `baseUrl`. */
const PRODUCTION_BASE = "https://api.absolutepay.io";
const SANDBOX_BASE = "https://sandbox-api.absolutepay.io";

/** Build a `?a=1&b=2` query string from defined values (skips undefined/null). */
export function qs(params: Record<string, unknown>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/** The AbsolutePay API client. Compose once and reuse; each resource hangs off it. */
export class AbsolutePay implements Requester {
  private readonly apiKey: string;
  private readonly signingSecret: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  readonly balances: Balances;
  readonly fees: Fees;
  readonly payments: Payments;
  readonly payouts: Payouts;
  readonly refunds: Refunds;
  readonly conversions: Conversions;
  readonly invoices: Invoices;
  readonly subscriptions: Subscriptions;
  readonly giftcards: GiftCards;
  readonly offramp: OffRamp;
  readonly transactions: Transactions;

  constructor(config: AbsolutePayConfig) {
    if (!config.apiKey) throw new Error("AbsolutePay: apiKey is required");
    this.apiKey = config.apiKey;
    this.signingSecret = config.signingSecret;
    // baseUrl overrides everything; otherwise sandbox flag selects the public sandbox vs production.
    const resolvedBase = config.baseUrl ?? (config.sandbox ? SANDBOX_BASE : PRODUCTION_BASE);
    this.baseUrl = resolvedBase.replace(/\/$/, "");
    // Never send the API key + signing headers over cleartext. https required, except localhost for dev.
    const url = new URL(this.baseUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      throw new Error(`AbsolutePay: baseUrl must use https (got "${this.baseUrl}"); http is allowed only for localhost.`);
    }
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.fetchImpl = config.fetch ?? globalThis.fetch;

    this.balances = new Balances(this);
    this.fees = new Fees(this);
    this.payments = new Payments(this);
    this.payouts = new Payouts(this);
    this.refunds = new Refunds(this);
    this.conversions = new Conversions(this);
    this.invoices = new Invoices(this);
    this.subscriptions = new Subscriptions(this);
    this.giftcards = new GiftCards(this);
    this.offramp = new OffRamp(this);
    this.transactions = new Transactions(this);
  }

  /** Low-level request. `path` is the path+query (e.g. `/v1/balances?quote=USDT`). Throws AbsolutePayError on non-2xx. */
  async request<T>(method: HttpMethod, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const bodyStr = body !== undefined ? JSON.stringify(body) : "";
    const headers: Record<string, string> = { authorization: `Bearer ${this.apiKey}` };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (this.signingSecret) Object.assign(headers, signRequest(this.signingSecret, method, path, bodyStr));
    // Extra headers (e.g. Idempotency-Key) are not part of the signed canonical string, so merge after signing.
    if (extraHeaders) Object.assign(headers, extraHeaders);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        signal: ctrl.signal,
        ...(body !== undefined ? { body: bodyStr } : {}),
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    const reqId = res.headers.get("x-request-id") ?? undefined;
    if (!res.ok) {
      let code = "error";
      let title = `HTTP ${res.status}`;
      let detail: string | undefined;
      try {
        const p = JSON.parse(text) as { code?: string; title?: string; detail?: string };
        code = p.code ?? code;
        title = p.title ?? title;
        detail = p.detail;
      } catch {
        if (text) detail = text.slice(0, 300);
      }
      throw new AbsolutePayError(res.status, code, title, detail, reqId);
    }
    return (text ? JSON.parse(text) : null) as T;
  }
}
