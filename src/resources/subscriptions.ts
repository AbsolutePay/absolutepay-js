import type { Requester } from "../client.js";
import type { Money } from "../types.js";

export interface CreatePlanParams {
  merchantPlanNo: string;
  name: string;
  amount: Money;
  interval: string;
  intervalCount: number;
  totalCycles: number;
}

export interface CreateSubscriptionParams {
  merchantSubNo: string;
  planNo: string;
  callbackUrl?: string;
}

/** Recurring billing: plans + subscriptions (scopes: subscriptions:read / subscriptions:write). */
export class Subscriptions {
  constructor(private readonly c: Requester) {}

  listPlans(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/subscription-plans");
  }
  createPlan(params: CreatePlanParams): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/subscription-plans", params);
  }

  list(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/subscriptions");
  }
  create(params: CreateSubscriptionParams): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/subscriptions", params);
  }

  /** Per-cycle deduction history for a subscription. */
  deductions(merchantSubNo: string): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/subscriptions/${encodeURIComponent(merchantSubNo)}/deductions`);
  }
  cancel(merchantSubNo: string): Promise<Record<string, unknown>> {
    return this.c.request("POST", `/v1/subscriptions/${encodeURIComponent(merchantSubNo)}/cancel`);
  }
}
