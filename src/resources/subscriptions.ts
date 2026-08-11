import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { IdempotencyOptions, Money, Page, PageQuery } from "../types.js";
import { idempotencyHeaders } from "../types.js";

/** Parameters for creating a recurring billing plan (the reusable template a subscription is based on). */
export interface CreatePlanParams {
  /** Your unique plan reference. Required. */
  merchantPlanNo: string;
  /** Human-readable plan name. Required. */
  name: string;
  /** Amount charged each cycle (decimal-string amount + currency). Required. */
  amount: Money;
  /** Billing interval unit, e.g. `"day"`, `"week"`, `"month"`. Required. */
  interval: string;
  /** Number of `interval` units per cycle (e.g. `interval="month"`, `intervalCount=3` → quarterly). Required. */
  intervalCount: number;
  /** Total number of cycles to bill before the plan completes. Required. */
  totalCycles: number;
  /** Optional free-trial length in days (0–365). When > 0 the customer authorizes but isn't charged until the trial ends; the subscription reports `TRIALING` until then. Omitted/0 charges immediately after authorization. */
  trialDays?: number;
}

/** Parameters for subscribing a customer to an existing plan. */
export interface CreateSubscriptionParams {
  /** Your unique subscription reference. Required. */
  merchantSubNo: string;
  /** The plan's number (`merchantPlanNo`) to subscribe to. Required. */
  planNo: string;
  /** Optional per-subscription callback URL for lifecycle/deduction notifications. */
  callbackUrl?: string;
}

/** Recurring billing plans — the reusable templates subscriptions are created from (scope: `subscriptions:*`). */
export class Plans {
  constructor(private readonly c: Requester) {}

  /**
   * List all subscription plans (scope: `subscriptions:read`).
   * @returns The raw `{ items, nextCursor }` (nextCursor always `null`) of plan records.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `subscriptions:read`).
   */
  list(): Promise<Page> {
    return this.c.request("GET", "/v1/subscription-plans");
  }

  /**
   * Create a recurring billing plan (scope: `subscriptions:write`).
   * @param params - The plan definition; see {@link CreatePlanParams}.
   * @param opts - Optional `{ idempotencyKey }` — retrying with the same key + body replays the original.
   * @returns The created plan record.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `subscriptions:write`, 409 duplicate `merchantPlanNo`).
   */
  create(params: CreatePlanParams, opts: IdempotencyOptions = {}): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/subscription-plans", params, idempotencyHeaders(opts));
  }
}

/** Recurring billing: subscriptions (+ the {@link Subscriptions.plans} sub-resource for plan templates). */
export class Subscriptions {
  /** Recurring billing plan templates (`plans.list` / `plans.create`). */
  readonly plans: Plans;
  constructor(private readonly c: Requester) {
    this.plans = new Plans(c);
  }

  /**
   * List subscriptions (scope: `subscriptions:read`). Keyset-paginated.
   * @param query - Filters + pagination; pass a prior page's `nextCursor` as `before`.
   * @param query.status - Optional status filter (e.g. `"active"`, `"canceled"`).
   * @returns The raw `{ items, nextCursor }` page of subscription records.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `subscriptions:read`).
   */
  list(query: PageQuery & { status?: string } = {}): Promise<Page> {
    return this.c.request("GET", `/v1/subscriptions${qs(query)}`);
  }

  /**
   * Subscribe a customer to a plan (scope: `subscriptions:write`).
   * @param params - The subscription to create; see {@link CreateSubscriptionParams}.
   * @param opts - Optional `{ idempotencyKey }` — retrying with the same key + body replays the original.
   * @returns The created subscription record.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 auth, 404 unknown plan, 409 duplicate `merchantSubNo`).
   */
  create(params: CreateSubscriptionParams, opts: IdempotencyOptions = {}): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/subscriptions", params, idempotencyHeaders(opts));
  }

  /**
   * Fetch the per-cycle deduction (charge) history for a subscription (scope: `subscriptions:read`).
   * @param merchantSubNo - The subscription reference (`merchantSubNo`).
   * @returns The raw `{ items, nextCursor }` (nextCursor always `null`) of deduction records.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown subscription).
   */
  deductions(merchantSubNo: string): Promise<Page> {
    return this.c.request("GET", `/v1/subscriptions/${encodeURIComponent(merchantSubNo)}/deductions`);
  }

  /**
   * Cancel a subscription so no further cycles are charged (scope: `subscriptions:write`).
   * @param merchantSubNo - The subscription reference (`merchantSubNo`).
   * @returns The updated subscription record.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown subscription, 409 already canceled).
   */
  cancel(merchantSubNo: string): Promise<Record<string, unknown>> {
    return this.c.request("POST", `/v1/subscriptions/${encodeURIComponent(merchantSubNo)}/cancel`);
  }
}
