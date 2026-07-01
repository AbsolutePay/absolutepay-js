import { createHmac, timingSafeEqual } from "node:crypto";
import { WebhookSignatureError } from "./errors.js";

/**
 * A delivered callback event — the JSON body the platform POSTs to your callback URL.
 *
 * Known {@link WebhookEvent.type} values include `payment.succeeded`, `charge.refunded`,
 * `payout.settled`, `payout.partial`, and `payout.failed`. Always obtain this via
 * {@link constructEvent} so the signature is verified before you trust the payload.
 *
 * @typeParam T - Shape of the event-specific {@link WebhookEvent.data} payload.
 */
export interface WebhookEvent<T = Record<string, unknown>> {
  /** Unique event id — use it to de-duplicate deliveries (the same event may arrive more than once). */
  readonly id: string;
  /** Event type, e.g. `"payment.succeeded"`, `"charge.refunded"`, `"payout.settled"`, `"payout.partial"`, `"payout.failed"`. */
  readonly type: string;
  /** Event-specific payload (the object that changed). Type it via the generic `T` for the events you handle. */
  readonly data: T;
}

const HEADER_TS = "x-absolutepay-timestamp";
const HEADER_SIG = "x-absolutepay-signature";

function header(headers: Record<string, string | string[] | undefined>, name: string): string {
  const v = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/**
 * Constant-time check that a webhook signature is authentic.
 *
 * Recomputes `HMAC_SHA512(secret, "${timestamp}.${rawBody}")` and compares it to the
 * supplied signature. Prefer {@link constructEvent}, which also parses the event and
 * enforces timestamp freshness; use this only for a fully custom handler.
 *
 * @param secret - Your app's callback signing secret (`whsec_…`).
 * @param rawBody - The EXACT raw request body string (do not re-serialize parsed JSON — whitespace matters).
 * @param timestamp - Value of the `X-AbsolutePay-Timestamp` header (epoch ms string).
 * @param signature - Value of the `X-AbsolutePay-Signature` header (hex).
 * @returns `true` if the signature matches; `false` if any input is missing or it does not match.
 */
export function verifySignature(secret: string, rawBody: string, timestamp: string, signature: string): boolean {
  if (!secret || !timestamp || !signature) return false;
  const expected = createHmac("sha512", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Default freshness window for webhook timestamps (replay defense): 5 minutes, in milliseconds. */
export const DEFAULT_WEBHOOK_TOLERANCE_MS = 5 * 60_000;

/** Options for {@link constructEvent}. */
export interface ConstructEventOpts {
  /**
   * Maximum allowed age of the callback timestamp, in milliseconds (replay defense).
   * Defaults to {@link DEFAULT_WEBHOOK_TOLERANCE_MS} (5 min). Set to `0` to disable the
   * freshness check entirely (verify signature only) — e.g. when replaying stored events in tests.
   */
  toleranceMs?: number;
}

/**
 * Verify a callback's signature and return the parsed, typed event — the safe way to consume a webhook.
 *
 * Recomputes the HMAC over the raw body and rejects the delivery on a bad signature or a
 * timestamp outside the freshness window. Give it the RAW (unparsed) body string — parsing
 * and re-serializing JSON changes bytes and breaks the signature.
 *
 * @typeParam T - Shape of the returned {@link WebhookEvent.data} payload.
 * @param rawBody - The exact raw HTTP request body as a string.
 * @param headers - The inbound request headers (case-insensitive lookup; array values take the first).
 * @param secret - Your app's callback signing secret (`whsec_…`).
 * @param opts - Optional {@link ConstructEventOpts} (e.g. `{ toleranceMs: 0 }` to skip freshness).
 * @returns The verified, JSON-parsed {@link WebhookEvent}.
 * @throws {WebhookSignatureError} If the signature is invalid or the timestamp is outside tolerance.
 * @example
 * ```ts
 * app.post("/webhooks", (req, res) => {
 *   let event;
 *   try {
 *     event = constructEvent(req.rawBody, req.headers, process.env.WEBHOOK_SECRET!);
 *   } catch {
 *     return res.status(400).send("bad signature");
 *   }
 *   if (event.type === "payment.succeeded") { /* fulfill order *\/ }
 *   res.sendStatus(200);
 * });
 * ```
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
