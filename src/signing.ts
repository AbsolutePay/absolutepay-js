import { createHash, createHmac, randomUUID } from "node:crypto";

/**
 * Per-request signature the platform requires for app (tenant) keys. Binds the method + full path
 * (with query) + a hash of the body, so a captured signature can't be redirected to another operation.
 * Canonical string: `METHOD\npath\ntimestamp\nnonce\nsha256hex(body)`; SIGN = hex(HMAC_SHA512(secret, canonical)).
 */
export function canonicalRequest(method: string, path: string, ts: string, nonce: string, body: string): string {
  const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
  return `${method.toUpperCase()}\n${path}\n${ts}\n${nonce}\n${bodyHash}`;
}

export interface SignatureHeaders {
  "x-absolutepay-timestamp": string;
  "x-absolutepay-nonce": string;
  "x-absolutepay-signature": string;
}

/** Build the signature headers for one request. `path` MUST be the path+query exactly as sent. */
export function signRequest(secret: string, method: string, path: string, body: string): SignatureHeaders {
  const ts = String(Date.now());
  const nonce = randomUUID();
  const signature = createHmac("sha512", secret).update(canonicalRequest(method, path, ts, nonce, body)).digest("hex");
  return { "x-absolutepay-timestamp": ts, "x-absolutepay-nonce": nonce, "x-absolutepay-signature": signature };
}
