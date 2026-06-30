import type { Requester } from "../client.js";
import type { Money } from "../types.js";

export interface CreateGiftCardParams {
  title: string;
  templateId: string;
  amount: Money;
}

/** Gift cards (scopes: balances:read to read, payments:write to issue). */
export class GiftCards {
  constructor(private readonly c: Requester) {}

  templates(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/giftcards/templates");
  }
  list(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/giftcards");
  }
  get(cardNum: string): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/giftcards/${encodeURIComponent(cardNum)}`);
  }
  create(params: CreateGiftCardParams): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/giftcards", params);
  }
}
