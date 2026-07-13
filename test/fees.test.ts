import { describe, expect, it } from "bun:test";
import { AbsolutePay } from "../src/client.js";
import { AbsolutePayError } from "../src/errors.js";

interface Captured {
  url: string;
}

/** A fetch stub that records the request URL and returns a canned fee preview. */
function stub(json: unknown): { fetch: typeof globalThis.fetch; last: () => Captured } {
  let captured: Captured | undefined;
  const fetchImpl = (async (url: string) => {
    captured = { url: String(url) };
    return new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof globalThis.fetch;
  return {
    fetch: fetchImpl,
    last: () => {
      if (!captured) throw new Error("fetch not called");
      return captured;
    },
  };
}

function client(fetch: typeof globalThis.fetch): AbsolutePay {
  return new AbsolutePay({ apiKey: "ap_live_x", signingSecret: "apisign_x", baseUrl: "https://api.test", fetch });
}

const PREVIEW = { amount: "4.000000", currency: "USDT", paymentType: "WITHDRAWAL", fee: "0.10", net: "3.90" };

describe("fees.preview — chain (platform-179)", () => {
  it("forwards chain in the query for a WITHDRAWAL preview", async () => {
    const s = stub(PREVIEW);
    await client(s.fetch).fees.preview({ amount: "4.000000", currency: "USDT", paymentType: "WITHDRAWAL", chain: "MATIC" });
    expect(s.last().url).toBe("https://api.test/v1/fees/preview?amount=4.000000&currency=USDT&paymentType=WITHDRAWAL&chain=MATIC");
  });

  it("throws chain_required (400) client-side when WITHDRAWAL/PAYOUT has no chain — no request made", () => {
    const s = stub(PREVIEW);
    for (const paymentType of ["WITHDRAWAL", "PAYOUT"] as const) {
      expect(() => client(s.fetch).fees.preview({ amount: "4", currency: "USDT", paymentType })).toThrow(AbsolutePayError);
      try {
        client(s.fetch).fees.preview({ amount: "4", currency: "USDT", paymentType });
      } catch (e) {
        expect((e as AbsolutePayError).code).toBe("chain_required");
        expect((e as AbsolutePayError).status).toBe(400);
      }
    }
  });

  it("omits chain for a pay-in (CHECKOUT) preview", async () => {
    const s = stub({ amount: "4", currency: "USDT", paymentType: "CHECKOUT", fee: "0.04", net: "3.96" });
    await client(s.fetch).fees.preview({ amount: "4", currency: "USDT" });
    expect(s.last().url).toBe("https://api.test/v1/fees/preview?amount=4&currency=USDT");
  });
});
