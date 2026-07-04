import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Page, PageQuery } from "../types.js";

/** A network you can receive deposits on, plus the coins it accepts. */
export interface DepositChain {
  /** Network code, e.g. `"ETH"`. */
  chain: string;
  /** Human-readable label, e.g. `"Ethereum(ERC20)"`. */
  label: string;
  /** Coins this network can receive, e.g. `["ETH", "USDT", "USDC"]`. */
  currencies: string[];
}

/** A permanent, reusable receive address for one network. */
export interface DepositAddress {
  /** Network code this address is on, e.g. `"ETH"`. */
  chain: string;
  /** Permanent on-chain receive address. */
  address: string;
  /** Destination tag/memo — required on memo networks; sending without it can lose funds. */
  memo?: string;
  /** Coins this address accepts on its network, e.g. `["ETH", "USDT", "USDC"]`. */
  currencies: string[];
  /** When the address was first created, unix ms (present on list/detail reads). */
  createdAt?: number;
}

/** A settled deposit credited to the workspace. */
export interface Deposit {
  /** Provider transaction id (stable dedupe key). */
  transactionId: string;
  /** Network code, e.g. `"TRX"`. */
  chain: string;
  /** Coin credited, e.g. `"USDT"`. */
  currency: string;
  /** Amount credited, in the coin's units, as a decimal string. */
  amount: string;
  /** Settlement status, e.g. `"PAID"`. */
  status: string;
  /** On-chain transaction hash, when available. */
  txHash?: string;
  /** Settlement time, unix ms. */
  createdAt?: number;
}

/**
 * Receive crypto directly into the workspace via permanent per-network addresses, and read the
 * settled deposit history (scope: `balances:read`).
 */
export class Deposits {
  constructor(private readonly c: Requester) {}

  /**
   * List the networks you can deposit on and the coins each accepts.
   * @returns The raw `{ items, nextCursor }` (nextCursor always `null`) of {@link DepositChain}.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `balances:read`).
   */
  chains(): Promise<Page<DepositChain>> {
    return this.c.request("GET", "/v1/deposits/chains");
  }

  /**
   * Mint (or return the existing) permanent deposit address for a network. Idempotent — reusable
   * and stable per network.
   * @param params - Options.
   * @param params.chain - Network code from {@link Deposits.chains}, e.g. `"ETH"`. Required.
   * @returns The {@link DepositAddress} for that network.
   * @throws {AbsolutePayError} On failure (e.g. 422 unsupported chain, 401/403 auth).
   */
  createAddress(params: { chain: string }): Promise<DepositAddress> {
    return this.c.request("POST", "/v1/deposits/address", params);
  }

  /**
   * List your minted deposit addresses (scope: `balances:read`). Keyset-paginated.
   * @param query - Optional `chain` filter + pagination (`limit`/`before`/`order`).
   * @returns The raw `{ items, nextCursor }` page of {@link DepositAddress}.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 auth).
   */
  addresses(query: PageQuery & { chain?: string } = {}): Promise<Page<DepositAddress>> {
    return this.c.request("GET", `/v1/deposits/addresses${qs(query)}`);
  }

  /**
   * Get your deposit address for a single network.
   * @param chain - Network code, e.g. `"ETH"`.
   * @returns The {@link DepositAddress}.
   * @throws {AbsolutePayError} On failure (e.g. 404 no address minted for the chain).
   */
  getAddress(chain: string): Promise<DepositAddress> {
    return this.c.request("GET", `/v1/deposits/addresses/${encodeURIComponent(chain)}`);
  }

  /**
   * List settled deposit history — inbound credits to the workspace (scope: `balances:read`). Keyset-paginated.
   * @param query - Filters + pagination.
   * @param query.chain - Restrict to one network. Optional.
   * @param query.from - Inclusive start of the window, epoch milliseconds. Optional.
   * @param query.to - Inclusive end of the window, epoch milliseconds. Optional.
   * @returns The raw `{ items, nextCursor }` page of {@link Deposit}.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 auth).
   */
  list(query: PageQuery & { chain?: string; from?: number; to?: number } = {}): Promise<Page<Deposit>> {
    return this.c.request("GET", `/v1/deposits${qs(query)}`);
  }
}
