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

  it("builds query strings and serializes POST bodies", async () => {
    const s = stub(200, { quote: "USDT", total: "0", lines: [] });
    await client(s).balances.summary({ quote: "USDT" });
    expect(s.last().url).toBe("https://api.test/v1/balances/summary?quote=USDT");

    const s2 = stub(201, { token: "inv_1" });
    await client(s2).invoices.create({ reference: "r1", amount: { amount: "1.00", currency: "USDT" }, chain: "MATIC" });
    const r2 = s2.last();
    expect(r2.method).toBe("POST");
    expect(JSON.parse(r2.body ?? "{}")).toMatchObject({ reference: "r1", chain: "MATIC" });
    expect(r2.headers["content-type"]).toBe("application/json");
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
