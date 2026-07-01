import type { Requester } from "../client.js";
import { qs } from "../client.js";
import type { Money, Page, PageQuery } from "../types.js";

/** Parameters for issuing a gift card. */
export interface CreateGiftCardParams {
  /** Display title / message on the card. Required. */
  title: string;
  /** Design template id to render the card with (from {@link GiftCards.templates}). Required. */
  templateId: string;
  /** Face value to load (decimal-string amount + currency). Required. */
  amount: Money;
}

/** Issue and read gift cards (scopes: `balances:read` to read, `payments:write` to issue). */
export class GiftCards {
  constructor(private readonly c: Requester) {}

  /**
   * List the available gift-card design templates (scope: `balances:read`).
   * @returns The templates payload (use a template's id as {@link CreateGiftCardParams.templateId}).
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `balances:read`).
   */
  templates(): Promise<Record<string, unknown>> {
    return this.c.request("GET", "/v1/giftcards/templates");
  }
  /**
   * List issued gift cards (scope: `balances:read`). Keyset-paginated.
   * @param query - Filters + pagination. Pass a prior page's {@link Page.nextCursor} as `before`.
   * @param query.status - Optional status filter (e.g. `"active"`, `"redeemed"`).
   * @param query.limit - Max items per page.
   * @param query.before - Cursor from the previous page.
   * @returns A {@link Page} of gift-card records; `nextCursor` is `null` on the last page.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `balances:read`).
   */
  list(query: PageQuery & { status?: string } = {}): Promise<Page> {
    return this.c.request("GET", `/v1/giftcards${qs(query)}`);
  }
  /**
   * Fetch a single gift card by its card number (scope: `balances:read`).
   * @param cardNum - The gift card's number.
   * @returns The gift-card record.
   * @throws {AbsolutePayError} On failure (e.g. 404 unknown card).
   */
  get(cardNum: string): Promise<Record<string, unknown>> {
    return this.c.request("GET", `/v1/giftcards/${encodeURIComponent(cardNum)}`);
  }
  /**
   * Issue a new gift card, debiting its face value from your balance (scope: `payments:write`).
   * @param params - The card to issue; see {@link CreateGiftCardParams}.
   * @returns The created gift-card record.
   * @throws {AbsolutePayError} On failure (e.g. 401/403 missing `payments:write`, 422 insufficient balance, 404 unknown template).
   */
  create(params: CreateGiftCardParams): Promise<Record<string, unknown>> {
    return this.c.request("POST", "/v1/giftcards", params);
  }
}
