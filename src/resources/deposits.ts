import type { Requester } from "../client.js";

/** Fund the workspace directly by sending crypto to your own permanent deposit addresses (scope: `balances:read`). */
export class Deposits {
  constructor(private readonly c: Requester) {}

  /**
   * List the networks you can deposit on and the coins each network accepts.
   * @returns `{ chains }` — the supported deposit networks plus their accepted assets.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `balances:read`, 429 rate limit).
   */
  chains(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/deposits/chains");
  }

  /**
   * Get (minting on first use) your permanent deposit address for a given network. Reusable and stable.
   * @param params - Options.
   * @param params.chain - Network to deposit on, e.g. `"TRON"` (from {@link Deposits.chains}).
   * @returns Your permanent deposit address for that network.
   * @throws {AbsolutePayError} On failure (e.g. 422 unsupported chain, 401/403 missing `balances:read`).
   */
  createAddress(params: { chain: string }): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/deposits/address", params);
  }
}
