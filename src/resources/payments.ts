import type { Requester } from "../client.js";
import type { Money } from "../types.js";

export interface CreateCheckoutParams {
  amount: Money;
  chain: string;
  merchantUserId: number;
  goodsName: string;
  merchantTradeNo?: string;
  terminalType?: "WEB" | "APP" | "WAP" | "MINIAPP" | "OTHERS";
  expiresIn?: number;
  method?: "redirect" | "web" | "qr";
}

export interface Checkout {
  merchantTradeNo: string;
  prepayId?: string;
  paymentUrl?: string;
  status?: string;
  [k: string]: unknown;
}

/** Hosted/native pay-in checkouts (scope: payments:write). */
export class Payments {
  constructor(private readonly c: Requester) {}

  /** Create a pay-in order. */
  createCheckout(params: CreateCheckoutParams): Promise<Checkout> {
    return this.c.request("POST", "/v1/checkout", params);
  }

  /** Look up a checkout by merchant trade number. */
  getCheckout(merchantTradeNo: string): Promise<Checkout> {
    return this.c.request("GET", `/v1/checkout/${encodeURIComponent(merchantTradeNo)}`);
  }
}
