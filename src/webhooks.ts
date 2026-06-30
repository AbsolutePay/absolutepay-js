import { createHmac, timingSafeEqual } from "node:crypto";
import { WebhookSignatureError } from "./errors.js";

/** A delivered callback event (the JSON body the platform POSTs to your callback URL). */
export interface WebhookEvent<T = Record<string, unknown>> {
  readonly id: string;
  readonly type: string;
  readonly data: T;
}

const HEADER_TS = "x-absolutepay-timestamp";
const HEADER_SIG = "x-absolutepay-signature";

function header(headers: Record<string, string | string[] | undefined>, name: string): string {
  const v = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/** True if the HMAC-SHA512 over `${timestamp}.${rawBody}` matches the provided signature. */
export function verifySignature(secret: string, rawBody: string, timestamp: string, signature: string): boolean {
  if (!secret || !timestamp || !signature) return false;
  const expected = createHmac("sha512", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Default freshness window for webhook timestamps (replay defense). Matches common processor defaults. */
export const DEFAULT_WEBHOOK_TOLERANCE_MS = 5 * 60_000;

export interface ConstructEventOpts {
  /** Reject callbacks whose timestamp is outside this window (replay defense). Defaults to 5 min; set 0 to disable. */
  toleranceMs?: number;
}

/**
 * Verify a callback's signature and return the parsed event — the safe way to consume a webhook.
 * Pass the RAW request body (string), the request headers, and your app's callback secret (`whsec_…`).
 * Throws WebhookSignatureError if the signature (or freshness) is invalid.
 */
export function constructEvent<T = Record<string, unknown>>(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
  opts: ConstructEventOpts = {},
): WebhookEvent<T> {
  const ts = header(headers, HEADER_TS);
  const sig = header(headers, HEADER_SIG);
  if (!verifySignature(secret, rawBody, ts, sig)) throw new WebhookSignatureError("invalid webhook signature");
  // Replay defense: enforce a freshness window by default (opt out with toleranceMs: 0).
  const tolerance = opts.toleranceMs ?? DEFAULT_WEBHOOK_TOLERANCE_MS;
  if (tolerance > 0) {
    const age = Math.abs(Date.now() - Number(ts));
    if (!Number.isFinite(age) || age > tolerance) throw new WebhookSignatureError("webhook timestamp outside tolerance");
  }
  return JSON.parse(rawBody) as WebhookEvent<T>;
}
