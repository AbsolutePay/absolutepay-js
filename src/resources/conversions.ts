import type { Requester } from "../client.js";
import type { Money } from "../types.js";

export interface QuoteParams {
  sellCurrency: string;
  buyCurrency: string;
  /** specify exactly one of sellAmount / buyAmount. */
  sellAmount?: string;
  buyAmount?: string;
}

export interface ConvertQuote {
  quoteId: string;
  rate: string;
  sellCurrency: string;
  sellAmount: string;
  buyCurrency: string;
  buyAmount: string;
}

export interface ConvertOrder {
  /** The conversion order number. */
  orderId: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  [k: string]: unknown;
}

/** Stablecoin/crypto conversions (scope: convert:write). */
export class Conversions {
  constructor(private readonly c: Requester) {}

  /** Preview a conversion (no funds move). */
  quote(params: QuoteParams): Promise<ConvertQuote> {
    return this.c.request("POST", "/v1/conversions/quote", params);
  }

  /** Execute a previously-quoted conversion. */
  execute(params: { quoteId: string; sell: Money; buy: Money }): Promise<ConvertOrder> {
    return this.c.request("POST", "/v1/conversions", params);
  }

  /** Convenience: quote then execute in one call. */
  async convert(params: QuoteParams): Promise<ConvertOrder> {
    const q = await this.quote(params);
    return this.execute({
      quoteId: q.quoteId,
      sell: { amount: q.sellAmount, currency: q.sellCurrency },
      buy: { amount: q.buyAmount, currency: q.buyCurrency },
    });
  }
}
