import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Page, PageQuery } from "../types.js";

export interface OffRampQuoteParams {
  cryptoCurrency: string;
  fiatCurrency: string;
  cryptoAmount: string;
}

export interface OffRampWithdrawParams {
  quoteToken: string;
  bankAccountId: string;
  cryptoCurrency: string;
  fiatCurrency: string;
  cryptoAmount: string;
  fiatAmount: string;
}

/** Crypto → fiat off-ramp to a bank account (scopes: payouts:read / payouts:write). */
export class OffRamp {
  constructor(private readonly c: Requester) {}

  countries(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/offramp/countries");
  }
  /** List the tenant's registered bank accounts. (Registering a new bank is a multipart upload — not yet wrapped.) */
  banks(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/offramp/banks");
  }
  quote(params: OffRampQuoteParams): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/offramp/quote", params);
  }
  withdraw(params: OffRampWithdrawParams): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/offramp/withdraw", params);
  }
  /** Keyset-paginated: pass a prior page's `nextCursor` as `before` for the next page. */
  orders(query: PageQuery & { status?: string } = {}): Promise<Page> {
    return this.c.request("GET", `/v1/offramp/orders${qs(query)}`);
  }
}
