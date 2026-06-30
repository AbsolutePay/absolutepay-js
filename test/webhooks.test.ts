import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { constructEvent, verifySignature } from "../src/webhooks.js";
import { WebhookSignatureError } from "../src/errors.js";

const SECRET = "whsec_test";

function sign(ts: string, body: string): string {
  return createHmac("sha512", SECRET).update(`${ts}.${body}`).digest("hex");
}

describe("webhook verification", () => {
  const body = JSON.stringify({ id: "evt_1", type: "payment.succeeded", data: { amount: "0.9", currency: "USDT" } });

  it("verifies a correctly-signed callback and returns the parsed event", () => {
    const ts = String(Date.now());
    const headers = { "x-absolutepay-timestamp": ts, "x-absolutepay-signature": sign(ts, body) };
    const evt = constructEvent<{ amount: string }>(body, headers, SECRET);
    expect(evt.type).toBe("payment.succeeded");
    expect(evt.data.amount).toBe("0.9");
  });

  it("rejects a bad signature", () => {
    const ts = String(Date.now());
    const headers = { "x-absolutepay-timestamp": ts, "x-absolutepay-signature": "deadbeef" };
    expect(() => constructEvent(body, headers, SECRET)).toThrow(WebhookSignatureError);
  });

  it("rejects a stale timestamp BY DEFAULT (replay defense on without opts)", () => {
    const ts = String(Date.now() - 10 * 60_000); // 10 min ago, default window is 5 min
    const headers = { "x-absolutepay-timestamp": ts, "x-absolutepay-signature": sign(ts, body) };
    expect(() => constructEvent(body, headers, SECRET)).toThrow(/tolerance/);
  });

  it("toleranceMs: 0 disables the freshness check (still verifies signature)", () => {
    const ts = String(Date.now() - 60 * 60_000); // an hour ago
    const headers = { "x-absolutepay-timestamp": ts, "x-absolutepay-signature": sign(ts, body) };
    expect(constructEvent(body, headers, SECRET, { toleranceMs: 0 }).type).toBe("payment.succeeded");
  });

  it("verifySignature is a pure boolean check", () => {
    const ts = "1700000000000";
    expect(verifySignature(SECRET, body, ts, sign(ts, body))).toBe(true);
    expect(verifySignature(SECRET, body, ts, "nope")).toBe(false);
  });
});
