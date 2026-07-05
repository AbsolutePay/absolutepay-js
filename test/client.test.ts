import { describe, expect, it } from "bun:test";
import { AbsolutePay } from "../src/client.js";
import type { AbsolutePayConfig } from "../src/client.js";
import { AbsolutePayError } from "../src/errors.js";

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

/** A fetch stub that records the request and returns a canned response. */
function stub(status: number, json: unknown): { fetch: typeof globalThis.fetch; last: () => Captured } {
  let captured: Captured | undefined;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    captured = { url, method: String(init.method), headers: init.headers as Record<string, string>, body: init.body as string | undefined };
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof globalThis.fetch;
  return {
    fetch: fetchImpl,
    last: () => {
      if (!captured) throw new Error("fetch not called");
      return captured;
    },
  };
}

function client(s: ReturnType<typeof stub>): AbsolutePay {
  return new AbsolutePay({ apiKey: "ap_live_x", signingSecret: "apisign_x", baseUrl: "https://api.test", fetch: s.fetch });
}

describe("AbsolutePay client", () => {
  it("requires an apiKey", () => {
    expect(() => new AbsolutePay({ apiKey: "" })).toThrow(/apiKey/);
  });

  it("rejects a non-https baseUrl (cleartext credential guard), but allows localhost", () => {
    expect(() => new AbsolutePay({ apiKey: "k", baseUrl: "http://api.evil.com" })).toThrow(/https/);
    expect(() => new AbsolutePay({ apiKey: "k", baseUrl: "http://localhost:3000" })).not.toThrow();
    expect(() => new AbsolutePay({ apiKey: "k", baseUrl: "https://api.test" })).not.toThrow();
  });

  it("signs every request and sends the bearer token", async () => {
    const s = stub(200, [{ currency: "USDT", available: "1", locked: "0" }]);
    await client(s).balances.list();
    const r = s.last();
    expect(r.url).toBe("https://api.test/v1/balances");
    expect(r.method).toBe("GET");
    expect(r.headers["authorization"]).toBe("Bearer ap_live_x");
    expect(r.headers["x-absolutepay-signature"]).toBeTruthy();
    expect(r.headers["x-absolutepay-nonce"]).toBeTruthy();
  });

  it("builds keyset list query strings and serializes POST bodies", async () => {
    const s = stub(200, { items: [], nextCursor: null });
    await client(s).checkouts.list({ status: "OPEN", limit: 25, before: "cur_1", order: "asc", q: "acme" });
    expect(s.last().url).toBe("https://api.test/v1/checkouts?status=OPEN&limit=25&before=cur_1&order=asc&q=acme");

    const s2 = stub(201, { token: "inv_1", address: "T...", chain: "TRON", currency: "USDT", amount: "1.00" });
    await client(s2).invoices.create({ reference: "r1", amount: { amount: "1.00", currency: "USDT" }, chain: "TRON" });
    const r2 = s2.last();
    expect(r2.method).toBe("POST");
    expect(JSON.parse(r2.body ?? "{}")).toMatchObject({ reference: "r1", chain: "TRON" });
    expect(r2.headers["content-type"]).toBe("application/json");
  });

  it("returns the raw { items, nextCursor } list envelope", async () => {
    const s = stub(200, { items: [{ token: "inv_1" }], nextCursor: "cur_2" });
    const page = await client(s).invoices.list();
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe("cur_2");
  });

  it("creates a hosted checkout via checkouts.create (not invoices)", async () => {
    const s = stub(201, { token: "chk_1", checkoutUrl: "https://pay/chk_1", status: "OPEN" });
    const link = await client(s).checkouts.create({ reference: "r2", amount: { amount: "1.00", currency: "USDT" } });
    const r = s.last();
    expect(r.method).toBe("POST");
    expect(r.url).toBe("https://api.test/v1/checkouts");
    expect(link.checkoutUrl).toBe("https://pay/chk_1");
  });

  it("update -> PATCH and del -> DELETE on the token", async () => {
    const upd = stub(200, { token: "chk_1", status: "OPEN" });
    await client(upd).checkouts.update("chk_1", { paused: true, redirectUrl: null });
    const u = upd.last();
    expect(u.method).toBe("PATCH");
    expect(u.url).toBe("https://api.test/v1/checkouts/chk_1");
    expect(JSON.parse(u.body ?? "{}")).toEqual({ paused: true, redirectUrl: null });

    const del = stub(200, { ok: true });
    await client(del).invoices.del("inv_9");
    const d = del.last();
    expect(d.method).toBe("DELETE");
    expect(d.url).toBe("https://api.test/v1/invoices/inv_9");
  });

  it("maps a non-2xx problem+json into AbsolutePayError", async () => {
    const s = stub(403, { code: "forbidden", title: "requires invoices:read" });
    const c = client(s);
    let err: unknown;
    try {
      await c.invoices.list();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AbsolutePayError);
    const e = err as AbsolutePayError;
    expect(e.status).toBe(403);
    expect(e.code).toBe("forbidden");
    expect(e.isAuth).toBe(true);
  });

  it("forwards a payout Idempotency-Key header when given", async () => {
    const s = stub(202, { merchantBatchNo: "po_1", status: "PROCESSING", subOrders: [] });
    await client(s).payouts.create(
      { items: [{ recipientAddress: "0xabc", chain: "MATIC", amount: { amount: "1.00", currency: "USDT" } }] },
      { idempotencyKey: "batch-001" },
    );
    const r = s.last();
    expect(r.headers["Idempotency-Key"]).toBe("batch-001");
    expect(r.headers["x-absolutepay-signature"]).toBeTruthy(); // still signed
  });

  it("omits Idempotency-Key when not given", async () => {
    const s = stub(202, { merchantBatchNo: "po_1", status: "PROCESSING", subOrders: [] });
    await client(s).payouts.create({ items: [{ recipientAddress: "0xabc", chain: "MATIC", amount: { amount: "1.00", currency: "USDT" } }] });
    expect(s.last().headers["Idempotency-Key"]).toBeUndefined();
  });

  it("wires Idempotency-Key on refunds/conversions/offramp money POSTs", async () => {
    const refund = stub(201, { merchantTradeNo: "o1", refundRequestId: "rf_1", status: "PENDING", amount: "1", currency: "USDT" });
    await client(refund).refunds.create(
      { merchantTradeNo: "o1", amount: { amount: "1.00", currency: "USDT" } },
      { idempotencyKey: "rf-key" },
    );
    expect(refund.last().headers["Idempotency-Key"]).toBe("rf-key");

    const conv = stub(201, { orderId: "cv_1", status: "SUCCESS" });
    await client(conv).conversions.execute(
      { quoteId: "q1", sell: { amount: "1", currency: "USDT" }, buy: { amount: "1", currency: "USDC" } },
      { idempotencyKey: "cv-key" },
    );
    expect(conv.last().headers["Idempotency-Key"]).toBe("cv-key");
  });

  it("returns { items, total, nextCursor } from ledger history lists", async () => {
    const s = stub(200, { items: [{ recordId: "r1" }], total: 42, nextCursor: null });
    const page = await client(s).conversions.list({ from: 1, currency: "USDT" });
    expect(s.last().url).toBe("https://api.test/v1/conversions?from=1&currency=USDT");
    expect(page.total).toBe(42);
    expect(page.nextCursor).toBeNull();
  });

  it("exposes deposits addresses/getAddress/list", async () => {
    const addr = stub(200, { chain: "ETH", address: "0x1", currencies: ["ETH"] });
    await client(addr).deposits.getAddress("ETH");
    expect(addr.last().url).toBe("https://api.test/v1/deposits/addresses/ETH");

    const create = stub(200, { chain: "ETH", address: "0x1", currencies: ["ETH"] });
    await client(create).deposits.createAddress({ chain: "ETH" });
    const c = create.last();
    expect(c.method).toBe("POST");
    expect(c.url).toBe("https://api.test/v1/deposits/address");
  });

  it("does not sign when no signing secret is configured", async () => {
    const s = stub(200, []);
    await new AbsolutePay({ apiKey: "ap_test_x", baseUrl: "https://api.test", fetch: s.fetch }).balances.list();
    expect(s.last().headers["x-absolutepay-signature"]).toBeUndefined();
  });
});

describe("base URL resolution", () => {
  const hit = async (cfg: Partial<AbsolutePayConfig>) => {
    const s = stub(200, []);
    await new AbsolutePay({ apiKey: "k", fetch: s.fetch, ...cfg }).balances.list();
    return new URL(s.last().url).origin;
  };

  it("defaults to production", async () => {
    expect(await hit({})).toBe("https://api.absolutepay.io");
    expect(await hit({ sandbox: false })).toBe("https://api.absolutepay.io");
  });

  it("sandbox:true targets the public sandbox host (never an internal dev host)", async () => {
    expect(await hit({ sandbox: true })).toBe("https://sandbox-api.absolutepay.io");
  });

  it("baseUrl overrides the sandbox flag", async () => {
    expect(await hit({ sandbox: true, baseUrl: "https://api.test" })).toBe("https://api.test");
  });
});
