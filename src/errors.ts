/** Thrown when the API returns a non-2xx response. Carries the platform's problem+json fields. */
export class AbsolutePayError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string | undefined;
  readonly requestId: string | undefined;

  constructor(status: number, code: string, title: string, detail?: string, requestId?: string) {
    super(title || code || `HTTP ${status}`);
    this.name = "AbsolutePayError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.requestId = requestId;
  }

  /** 429 — too many requests; back off and retry after a moment. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }
  /** 401/403 — bad/insufficient credentials, missing scope, or invalid request signature. */
  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/** Thrown for signature-verification failures on inbound webhooks. */
export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}
