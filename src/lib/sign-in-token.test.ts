import { describe, expect, it } from "vitest";
import { openSignIn, sealSignIn } from "./sign-in-token";

const secret = "test-secret-test-secret-test-secret";
const claim = { email: "anna@example.fi", otp: "042719" };

describe("sign-in link token", () => {
  it("round-trips the address and code without showing either", () => {
    const token = sealSignIn(claim, secret);
    expect(token).not.toContain("anna");
    expect(token).not.toContain("042719");
    expect(openSignIn(token, secret)).toEqual(claim);
  });

  it("is different every time", () => {
    expect(sealSignIn(claim, secret)).not.toBe(sealSignIn(claim, secret));
  });

  it("refuses tampered, truncated or foreign tokens", () => {
    const token = sealSignIn(claim, secret);
    const flipped = `${token.slice(0, -2)}${token.endsWith("A") ? "B" : "A"}${token.slice(-1)}`;
    expect(openSignIn(flipped, secret)).toBeNull();
    expect(openSignIn(token.slice(0, 20), secret)).toBeNull();
    expect(openSignIn(token, "another-secret-another-secret")).toBeNull();
    expect(openSignIn("not a token", secret)).toBeNull();
  });
});
