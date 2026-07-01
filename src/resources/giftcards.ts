import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Money, Page, PageQuery } from "../types.js";

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
  /** Keyset-paginated: pass a prior page's `nextCursor` as `before` for the next page. */
  list(query: PageQuery & { status?: string } = {}): Promise<Page> {
    return this.c.request("GET", `/v1/giftcards${qs(query)}`);
  }
  get(cardNum: string): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/giftcards/${encodeURIComponent(cardNum)}`);
  }
  create(params: CreateGiftCardParams): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/giftcards", params);
  }
}
