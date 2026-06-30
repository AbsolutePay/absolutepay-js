import { describe, expect, it } from "bun:test";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { canonicalRequest, signRequest } from "../src/signing.js";

/** Mirror of the server's verifier — proves the SDK's signature interops with the platform. */
function serverVerify(secret: string, method: string, path: string, ts: string, nonce: string, body: string, sig: string): boolean {
  const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
  const canonical = `${method.toUpperCase()}\n${path}\n${ts}\n${nonce}\n${bodyHash}`;
  const expected = createHmac("sha512", secret).update(canonical).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

describe("request signing", () => {
  it("canonical string binds method, path+query, ts, nonce, and a body hash", () => {
    const c = canonicalRequest("get", "/v1/balances?quote=USDT", "1700000000000", "n1", "");
    const expectedBodyHash = createHash("sha256").update("", "utf8").digest("hex");
    expect(c).toBe(`GET\n/v1/balances?quote=USDT\n1700000000000\nn1\n${expectedBodyHash}`);
  });

  it("produces headers the server's verifier accepts (GET, no body)", () => {
    const secret = "apisign_test";
    const h = signRequest(secret, "GET", "/v1/balances", "");
    expect(h["x-absolutepay-timestamp"]).toMatch(/^\d{13}$/);
    expect(h["x-absolutepay-nonce"].length).toBeGreaterThan(8);
    expect(serverVerify(secret, "GET", "/v1/balances", h["x-absolutepay-timestamp"], h["x-absolutepay-nonce"], "", h["x-absolutepay-signature"])).toBe(true);
  });

  it("signs a POST body and binds it (a tampered body fails verification)", () => {
    const secret = "apisign_test";
    const body = JSON.stringify({ amount: { amount: "1", currency: "USDT" } });
    const h = signRequest(secret, "POST", "/v1/invoices", body);
    expect(serverVerify(secret, "POST", "/v1/invoices", h["x-absolutepay-timestamp"], h["x-absolutepay-nonce"], body, h["x-absolutepay-signature"])).toBe(true);
    expect(serverVerify(secret, "POST", "/v1/invoices", h["x-absolutepay-timestamp"], h["x-absolutepay-nonce"], `${body} `, h["x-absolutepay-signature"])).toBe(false);
  });
});
