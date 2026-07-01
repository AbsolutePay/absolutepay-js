import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Money, Page, PageQuery } from "../types.js";

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

/** Recurring billing: plans + subscriptions (scopes: `subscriptions:write` to mutate, `subscriptions:read` to read). */
export class Subscriptions {
  constructor(private readonly c: Requester) {}

  /**
   * List all subscription plans (scope: `subscriptions:read`).
   * @returns The plans payload.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `subscriptions:read`).
   */
  listPlans(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/subscription-plans");
  }
  /**
   * Create a recurring billing plan (scope: `subscriptions:write`).
   * @param params - The plan definition; see {@link CreatePlanParams}.
   * @returns The created plan payload.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `subscriptions:write`, 409 duplicate `merchantPlanNo`).
   */
  createPlan(params: CreatePlanParams): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/subscription-plans", params);
  }

  /**
   * List subscriptions (scope: `subscriptions:read`). Keyset-paginated.
   * @param query - Filters + pagination. Pass a prior page's {@link Page.nextCursor} as `before`.
   * @param query.status - Optional status filter (e.g. `"active"`, `"canceled"`).
   * @param query.limit - Max items per page.
   * @param query.before - Cursor from the previous page.
   * @returns A {@link Page} of subscription records; `nextCursor` is `null` on the last page.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `subscriptions:read`).
   */
  list(query: PageQuery & { status?: string } = {}): Promise<Page> {
    return this.c.request("GET", `/v1/subscriptions${qs(query)}`);
  }
  /**
   * Subscribe a customer to a plan (scope: `subscriptions:write`).
   * @param params - The subscription to create; see {@link CreateSubscriptionParams}.
   * @returns The created subscription payload.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 auth, 404 unknown plan, 409 duplicate `merchantSubNo`).
   */
  create(params: CreateSubscriptionParams): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/subscriptions", params);
  }

  /**
   * Fetch the per-cycle deduction (charge) history for a subscription (scope: `subscriptions:read`).
   * @param merchantSubNo - The subscription reference (`merchantSubNo`).
   * @returns The deduction history payload.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown subscription).
   */
  deductions(merchantSubNo: string): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/subscriptions/${encodeURIComponent(merchantSubNo)}/deductions`);
  }
  /**
   * Cancel a subscription so no further cycles are charged (scope: `subscriptions:write`).
   * @param merchantSubNo - The subscription reference (`merchantSubNo`).
   * @returns The updated subscription payload.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown subscription, 409 already canceled).
   */
  cancel(merchantSubNo: string): Promise<Record<string, unknown>> {
    return this.c.request("POST", `/v1/subscriptions/${encodeURIComponent(merchantSubNo)}/cancel`);
  }
}
