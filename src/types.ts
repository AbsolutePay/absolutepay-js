/** A money amount as a decimal string + currency code (e.g. { amount: "10.00", currency: "USDT" }). */
export interface Money {
  amount: string;
  currency: string;
}

export type PaymentType = "CHECKOUT" | "WITHDRAWAL" | "SUBSCRIPTION" | "CONVERSION" | "OFFRAMP" | "GIFTCARD";

/** A single asset balance. */
export interface Balance {
  currency: string;
  available: string;
  locked: string;
}

/** Fee preview: total fee = network base + your account-tier markup (from the pricing matrix). */
export interface FeePreview {
  amount: string;
  currency: string;
  paymentType: PaymentType;
  fee: string;
  net: string;
  markup: string;
  networkFee: string;
}
