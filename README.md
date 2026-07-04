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

const { items: balances } = await ap.balances.list();
const preview = await ap.fees.preview({ amount: "100", currency: "USDT" });

// Hosted checkout — the payer picks the asset/chain on the /pay/<token> page:
const checkout = await ap.checkouts.create({
  reference: "order-123",
  amount: { amount: "25.00", currency: "USDT" },
  redirectUrl: "https://shop.example.com/thanks", // payer returns here with ?token=…&status=… when done
});
console.log(checkout.checkoutUrl); // redirect the payer here
```

## Conventions

- **Lists** take `{ limit?, before?, order?, ...filters }` and return the raw `{ items, nextCursor }`.
  Page forward by echoing `nextCursor` back as `before`; `nextCursor: null` is the last page. The
  ledger-history lists (`refunds.list`, `conversions.list`, `reconciliation.*`) also carry `total`.
- **Money POSTs** accept a second `{ idempotencyKey }` argument that sets the `Idempotency-Key` header —
  retrying with the same key + body replays the original response (a different body returns `409`).
  Applies to `payouts.create`, `refunds.create`, `conversions.execute`, `offramp.withdraw`,
  `giftcards.create`, `subscriptions.create`, `subscriptions.plans.create`.
- **Errors** parse the `{ code, title, detail }` body into `AbsolutePayError`.

## Resources

| Namespace | Highlights |
|---|---|
| `ap.balances` | `list()` → `{ items }` |
| `ap.fees` | `preview({ amount, currency, paymentType? })` |
| `ap.checkouts` | `create(...)`, `list(query)`, `get(token)`, `update(token, patch)`, `del(token)` |
| `ap.invoices` | `create(...)` (**`chain` required**), `list(query)`, `get(token)`, `update(token, patch)`, `del(token)` |
| `ap.deposits` | `chains()`, `createAddress({ chain })`, `addresses(query)`, `getAddress(chain)`, `list(query)` |
| `ap.payouts` | `create(items, { idempotencyKey? })`, `options({ currency })`, `get(id)` |
| `ap.refunds` | `create(..., { idempotencyKey? })`, `get(id)`, `list(query)` |
| `ap.conversions` | `quote(...)`, `execute(..., { idempotencyKey? })`, `list(query)` |
| `ap.subscriptions` | `create(..., { idempotencyKey? })`, `list(query)`, `deductions(no)`, `cancel(no)`, `plans.list()`, `plans.create(..., { idempotencyKey? })` |
| `ap.giftcards` | `templates()`, `list(query)`, `get(num)`, `create(..., { idempotencyKey? })` |
| `ap.offramp` | `countries()`, `banks()`, `registerBank(...)`, `removeBank(id)`, `quote(...)`, `withdraw(..., { idempotencyKey? })`, `orders(query)` |
| `ap.reconciliation` | `payments(query)`, `withdrawals(query)` → `{ items, total, nextCursor }` |

### Checkouts vs invoices

- **`ap.checkouts`** — a hosted link where the payer picks the asset/chain on the `/pay/<token>` page.
  `create(...)` returns `{ token, checkoutUrl }`.
- **`ap.invoices`** — the up-front flow: pass the required `chain` and the deposit `address` is minted
  immediately. `create(...)` returns `{ token, address, chain, currency, amount }`.

Both support the same `list` / `get` / `update` / `del` CRUD (update patches `paused` /
`redirectUrl` / `expiresAt` / `description`; send `null` to clear a field; `del` voids the link).

```ts
const invoice = await ap.invoices.create({
  reference: "order-123",
  amount: { amount: "25.00", currency: "USDT" },
  chain: "TRON", // mint a deposit address up front
});
console.log(invoice.address);

await ap.checkouts.update(checkout.token, { paused: true }); // pause; { paused: false } resumes
await ap.checkouts.del(checkout.token); // void
```

Confirm settlement via the `payment.succeeded` webhook (see below) or by polling `ap.checkouts.get(token)`.

### Deposits (own-balance top-ups)

```ts
const { items: chains } = await ap.deposits.chains();
const address = await ap.deposits.createAddress({ chain: "ETH" }); // mint-or-return, idempotent
const { items: history } = await ap.deposits.list({ chain: "ETH" }); // settled deposit history
```

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
