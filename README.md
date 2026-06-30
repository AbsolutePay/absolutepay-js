# absolutepay

Official AbsolutePay API client for Node.js. Server-side only — your API key and signing secret must never reach a browser.

> Every request from an app key is HMAC-signed automatically. Inbound webhooks are verified with one call.

## Install

```bash
npm install absolutepay
```

Requires Node 18+ (uses the global `fetch` and `node:crypto`).

## Environments

| Config | Base URL |
|---|---|
| default | `https://api.absolutepay.io` (production) |
| `sandbox: true` | `https://sandbox-api.absolutepay.io` |
| `baseUrl: "https://…"` | your override (takes precedence over `sandbox`) |

Use a dedicated sandbox app (sign up at [sandbox.absolutepay.io](https://sandbox.absolutepay.io)) with `sandbox: true` to test end-to-end without moving real funds.

## Quickstart

```ts
import { AbsolutePay } from "absolutepay";

const ap = new AbsolutePay({
  apiKey: process.env.ABSOLUTEPAY_API_KEY!,       // ap_live_… / ap_test_…
  signingSecret: process.env.ABSOLUTEPAY_SIGNING_SECRET!, // apisign_…  (required for app keys)
  // sandbox: true,                // → https://sandbox-api.absolutepay.io (default is production)
  // baseUrl: "https://…",         // optional: override the origin entirely (wins over `sandbox`)
});

const balances = await ap.balances.list();
const preview = await ap.fees.preview({ amount: "100", currency: "USDT" });
const invoice = await ap.invoices.create({
  reference: "order-123",
  amount: { amount: "25.00", currency: "USDT" },
  chain: "MATIC", // mint a deposit address up front
});
console.log(invoice.token, invoice.address);
```

## Resources

| Namespace | Highlights |
|---|---|
| `ap.balances` | `list()`, `summary({ quote })` |
| `ap.fees` | `preview({ amount, currency, paymentType? })` |
| `ap.payments` | `createCheckout(...)`, `getCheckout(no)` |
| `ap.payouts` | `create({ items })`, `options({ currency })`, `get(id)` |
| `ap.refunds` | `create(...)`, `get(id)` |
| `ap.conversions` | `quote(...)`, `execute(...)`, `convert(...)` |
| `ap.invoices` | `create(...)`, `createCheckout(...)`, `list()`, `stats()`, `pause`, `void`, `ap.invoices.public.*` |
| `ap.subscriptions` | `listPlans()`, `createPlan(...)`, `list()`, `create(...)`, `deductions(no)`, `cancel(no)` |
| `ap.giftcards` | `templates()`, `list()`, `get(num)`, `create(...)` |
| `ap.offramp` | `countries()`, `banks(...)`, `quote(...)`, `withdraw(...)`, `orders()` |
| `ap.transactions` | `list({ startTime, endTime, page, count })` |

## Webhooks

Verify the signature and parse the event in one call. Pass the **raw** request body and your app's callback secret (`whsec_…`).

```ts
import { constructEvent } from "absolutepay";

// e.g. inside an Express handler with express.raw()
// Verifies the HMAC signature AND enforces a 5-minute freshness window by default (replay defense).
// Pass { toleranceMs: 0 } to disable the time check; de-dupe on event.id for full idempotency.
const event = constructEvent(rawBody, req.headers, process.env.ABSOLUTEPAY_WEBHOOK_SECRET!);
if (event.type === "payment.succeeded") {
  // fulfill the order — event.data has the order details
}
```

## Errors

Non-2xx responses throw `AbsolutePayError` with `status`, `code`, `title`, `detail`, and `requestId`,
plus `isAuth` / `isRateLimited` helpers.

```ts
import { AbsolutePayError } from "absolutepay";
try {
  await ap.payouts.create({ items: [...] });
} catch (e) {
  if (e instanceof AbsolutePayError && e.isRateLimited) { /* back off */ }
}
```

## Contract

Types track the published OpenAPI contract in `openapi/absolutepay.json` (regenerate with `bun run gen`).

## License

[MIT](./LICENSE) © AbsolutePay
