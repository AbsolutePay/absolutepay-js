import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Balance } from "../types.js";

/** A single combined-balance summary priced into one quote currency. */
export interface BalanceSummary {
  /** The quote currency every line is valued in, e.g. `"USDT"`. */
  quote: string;
  /** Grand total across all assets, expressed in {@link BalanceSummary.quote}, as a decimal string. */
  total: string;
  /** Per-asset breakdown that sums to {@link BalanceSummary.total}. */
  lines: Array<{
    /** Asset code for this line, e.g. `"BTC"`. */
    currency: string;
    /** Spendable amount of this asset, as a decimal string. */
    available: string;
    /** The `available` amount converted into the quote currency, as a decimal string. */
    value: string;
    /** FX rate used (asset → quote), as a decimal string. */
    rate: string;
    /** `true` if a live price was found; `false` if the asset could not be priced (then `value` may be `"0"`). */
    priced: boolean;
  }>;
}

/** Read the workspace's asset balances (scope: `balances:read`). */
export class Balances {
  constructor(private readonly c: Requester) {}

  /**
   * List every asset balance held by the workspace.
   * @returns An array of {@link Balance} (available + locked per currency).
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `balances:read`, 429 rate limit).
   * @example
   * ```ts
   * const balances = await client.balances.list();
   * for (const b of balances) console.log(b.currency, b.available);
   * ```
   */
  list(): Promise<Balance[]> {
    return this.c.request("GET", "/v1/balances");
  }

  /**
   * Get a combined balance valued into a single quote currency (all assets FX-converted and summed).
   * @param params - Options.
   * @param params.quote - Quote currency to price into (e.g. `"USDT"`, `"USD"`). Optional; defaults to `USDT` server-side.
   * @returns A {@link BalanceSummary} with the grand total and a per-asset breakdown.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `balances:read`).
   */
  summary(params: { quote?: string } = {}): Promise<BalanceSummary> {
    return this.c.request("GET", `/v1/balances/summary${qs({ quote: params.quote })}`);
  }
}
