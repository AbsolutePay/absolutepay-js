import { createHash, createHmac, randomUUID } from "node:crypto";

/**
 * Build the canonical string that gets HMAC-signed for a request.
 *
 * The signature binds the HTTP method + full path (including query) + a SHA-256 hash
 * of the body, so a captured signature cannot be replayed against a different
 * operation or with a tampered body. Exposed mainly for building a custom transport;
 * most callers never need it (the client signs automatically).
 *
 * Canonical form: `METHOD\npath\ntimestamp\nnonce\nsha256hex(body)`.
 *
 * @param method - HTTP method; upper-cased internally (e.g. `"POST"`).
 * @param path - Request path INCLUDING query string, exactly as sent (e.g. `/v1/balances?quote=USDT`).
 * @param ts - Timestamp string (epoch milliseconds) that also goes in the timestamp header.
 * @param nonce - Unique single-use value (e.g. a UUID) that also goes in the nonce header.
 * @param body - Raw request body string; empty string `""` for bodyless requests.
 * @returns The newline-joined canonical string ready to feed into `HMAC_SHA512`.
 */
export function canonicalRequest(method: string, path: string, ts: string, nonce: string, body: string): string {
  const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
  return `${method.toUpperCase()}\n${path}\n${ts}\n${nonce}\n${bodyHash}`;
}

/** The three headers the platform expects on every signed request. */
export interface SignatureHeaders {
  /** Signing timestamp in epoch milliseconds (string). Must be within the server's freshness window (±5 min). */
  "x-absolutepay-timestamp": string;
  /** Single-use nonce (UUID) tying this signature to one request; the server rejects reuse. */
  "x-absolutepay-nonce": string;
  /** `HMAC_SHA512(signingSecret, canonicalString)` as lowercase hex. */
  "x-absolutepay-signature": string;
}

/**
 * Compute the signature headers for one request. The SDK calls this automatically
 * for every request when a `signingSecret` is configured — call it directly only if
 * you are building your own transport.
 *
 * A fresh timestamp and nonce are generated on each call, so signatures are single-use.
 *
 * @param secret - The app's request-signing secret (`apisign_…`). Server-side only.
 * @param method - HTTP method (e.g. `"GET"`, `"POST"`).
 * @param path - Request path INCLUDING query string, exactly as it will be sent.
 * @param body - Raw request body string; pass `""` for requests without a body.
 * @returns The {@link SignatureHeaders} to merge into the outgoing request headers.
 */
export function signRequest(secret: string, method: string, path: string, body: string): SignatureHeaders {
  const ts = String(Date.now());
  const nonce = randomUUID();
  const signature = createHmac("sha512", secret).update(canonicalRequest(method, path, ts, nonce, body)).digest("hex");
  return { "x-absolutepay-timestamp": ts, "x-absolutepay-nonce": nonce, "x-absolutepay-signature": signature };
}
