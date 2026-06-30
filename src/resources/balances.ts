import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Balance } from "../types.js";

export interface BalanceSummary {
  quote: string;
  total: string;
  lines: Array<{ currency: string; amount: string; quoted: string; priced: boolean }>;
}

/** Tenant balances (scope: balances:read). */
export class Balances {
  constructor(private readonly c: Requester) {}

  /** All asset balances for the workspace. */
  list(): Promise<Balance[]> {
    return this.c.request("GET", "/v1/balances");
  }

  /** FX-valued combined balance in a quote currency (default USDT). */
  summary(params: { quote?: string } = {}): Promise<BalanceSummary> {
    return this.c.request("GET", `/v1/balances/summary${qs({ quote: params.quote })}`);
  }
}
