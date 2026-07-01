/**
 * Error thrown by every SDK method when the API returns a non-2xx response.
 *
 * Carries the platform's problem+json fields so you can branch on the failure
 * without re-parsing the body. The {@link AbsolutePayError.message} is the
 * human-readable `title` (falling back to `code`/status). Use {@link AbsolutePayError.isAuth}
 * and {@link AbsolutePayError.isRateLimited} for the common branches.
 *
 * @example
 * ```ts
 * try {
 *   await client.balances.list();
 * } catch (err) {
 *   if (err instanceof AbsolutePayError) {
 *     if (err.isAuth) console.error("check API key / scopes / signature");
 *     else if (err.isRateLimited) console.error("slow down");
 *     else console.error(err.code, err.detail, "request:", err.requestId);
 *   }
 * }
 * ```
 */
export class AbsolutePayError extends Error {
  /** HTTP status code of the failed response (e.g. `401`, `429`, `500`). */
  readonly status: number;
  /** Stable machine-readable error code from the response body (e.g. `"insufficient_scope"`), or `"error"` if absent. */
  readonly code: string;
  /** Longer human-readable explanation of what went wrong, when the API provides one. */
  readonly detail: string | undefined;
  /** Server-assigned request id (from the `x-request-id` header) — quote it in support tickets. */
  readonly requestId: string | undefined;

  /**
   * @param status - HTTP status code of the response.
   * @param code - Machine-readable error code from the body.
   * @param title - Short human-readable summary; becomes the Error `message`.
   * @param detail - Optional longer explanation.
   * @param requestId - Optional server request id for correlation.
   */
  constructor(status: number, code: string, title: string, detail?: string, requestId?: string) {
    super(title || code || `HTTP ${status}`);
    this.name = "AbsolutePayError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.requestId = requestId;
  }

  /**
   * `true` for HTTP 429 (rate limited) — you are sending requests too fast.
   * Back off and retry after a short delay.
   */
  get isRateLimited(): boolean {
    return this.status === 429;
  }
  /**
   * `true` for HTTP 401/403 — an authentication or authorization failure:
   * a bad/missing API key, insufficient scope for the operation, or an invalid
   * request signature. Not retryable without fixing credentials.
   */
  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/**
 * Error thrown when an inbound webhook fails signature verification.
 *
 * Raised by `constructEvent` (and surfaced when `verifySignature` is
 * used indirectly) for a bad/missing HMAC signature or a timestamp outside the
 * freshness window. Treat it as "reject this delivery" — respond 400 and do not
 * process the payload.
 */
export class WebhookSignatureError extends Error {
  /** @param message - Human-readable reason the signature check failed. */
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}
