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
import { Reconciliation } from "./resources/reconciliation.js";
import { Deposits } from "./resources/deposits.js";

/** HTTP verbs the SDK issues against the API. */
export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * The minimal transport contract a resource depends on — a single `request` method.
 *
 * Keeping resources bound to this interface (rather than the concrete {@link AbsolutePay})
 * decouples them from the HTTP layer, which makes them trivially testable with a stub.
 */
export interface Requester {
  /**
   * Issue one API call.
   * @typeParam T - Expected shape of the parsed JSON response.
   * @param method - HTTP method.
   * @param path - Path + query string (e.g. `/v1/balances?quote=USDT`).
   * @param body - Optional request body; JSON-serialized when present.
   * @param headers - Optional extra headers (e.g. an idempotency key); merged after signing.
   * @returns The parsed response body as `T`.
   * @throws {AbsolutePayError} On any non-2xx response.
   */
  request<T>(method: HttpMethod, path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
}

/** Configuration for constructing an {@link AbsolutePay} client. */
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

/**
 * Serialize a params object into a URL query string, URL-encoding keys and values
 * and skipping any that are `undefined`/`null`.
 *
 * @param params - Key/value pairs to encode; nullish values are omitted.
 * @returns A leading-`?` query string (e.g. `"?a=1&b=2"`), or `""` when nothing remains.
 */
export function qs(params: Record<string, unknown>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/**
 * The AbsolutePay API client — the entry point to the SDK.
 *
 * Construct it once with your credentials and reuse the instance; every resource
 * (payments, payouts, invoices, …) hangs off it as a property. When a `signingSecret`
 * is configured the client HMAC-signs every request automatically. This is a
 * SERVER-SIDE client: your API key and signing secret must never reach a browser.
 *
 * @example
 * ```ts
 * import { AbsolutePay } from "absolutepay";
 *
 * const client = new AbsolutePay({
 *   apiKey: process.env.ABSOLUTEPAY_API_KEY!,
 *   signingSecret: process.env.ABSOLUTEPAY_SIGNING_SECRET!, // apisign_…
 *   sandbox: true, // omit / false for production
 * });
 *
 * const balances = await client.balances.list();
 * ```
 */
export class AbsolutePay implements Requester {
  private readonly apiKey: string;
  private readonly signingSecret: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  /** Workspace asset balances and FX-valued summary (scope: `balances:read`). */
  readonly balances: Balances;
  /** Fee previews from the pricing matrix (scope: `balances:read`). */
  readonly fees: Fees;
  /** Pay-in checkouts / collections (scope: `payments:write`). */
  readonly payments: Payments;
  /** Batch crypto payouts (scopes: `payouts:write` / `payouts:read`). */
  readonly payouts: Payouts;
  /** Refunds on settled collections (scope: `payments:write`). */
  readonly refunds: Refunds;
  /** Asset-to-asset conversions (scope: `convert:write`). */
  readonly conversions: Conversions;
  /** Invoices and hosted payment links (scopes: `invoices:write` / `invoices:read`). */
  readonly invoices: Invoices;
  /** Recurring plans and subscriptions (scopes: `subscriptions:write` / `subscriptions:read`). */
  readonly subscriptions: Subscriptions;
  /** Gift-card issuance and templates (scopes: `balances:read` to read, `payments:write` to issue). */
  readonly giftcards: GiftCards;
  /** Crypto → fiat off-ramp to a bank account (scopes: `payouts:write` / `payouts:read`). */
  readonly offramp: OffRamp;
  /** Unified funds ledger and reconciliation export (scope: `ledger:read`). */
  readonly transactions: Transactions;
  /** Settled pay-in / withdrawal ledgers for reconciliation (scope: `ledger:read`). */
  readonly reconciliation: Reconciliation;
  /** Direct crypto deposits into the workspace via permanent addresses (scope: `balances:read`). */
  readonly deposits: Deposits;

  /**
   * Create a client.
   * @param config - Connection + credential options; see {@link AbsolutePayConfig}.
   * @throws {Error} If `apiKey` is missing, or if `baseUrl` uses a non-https scheme on a non-localhost host.
   */
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
    this.reconciliation = new Reconciliation(this);
    this.deposits = new Deposits(this);
  }

  /**
   * Low-level request primitive used by every resource. Adds the Bearer auth header,
   * signs the request when a signing secret is set, enforces the configured timeout,
   * and turns non-2xx responses into {@link AbsolutePayError}. You rarely call this
   * directly — prefer the typed resource methods — but it is available for endpoints
   * the SDK does not yet wrap.
   *
   * @typeParam T - Expected shape of the parsed JSON response.
   * @param method - HTTP method.
   * @param path - Path INCLUDING query string, e.g. `/v1/balances?quote=USDT`.
   * @param body - Optional request body; JSON-serialized and sent with `content-type: application/json`.
   * @param extraHeaders - Optional headers merged AFTER signing (e.g. `Idempotency-Key`), so they are not part of the signed canonical string.
   * @returns The parsed response body as `T` (or `null` when the response has no body).
   * @throws {AbsolutePayError} On any non-2xx response (401/403 auth, 429 rate limit, etc.).
   */
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
