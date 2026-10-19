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
    // Flip one bit of the last byte: always a change, unlike swapping a base64 character for a guessed one.
    const raw = Buffer.from(token, "base64url");
    raw[raw.length - 1] ^= 1;
    const flipped = raw.toString("base64url");
    expect(openSignIn(flipped, secret)).toBeNull();
    expect(openSignIn(token.slice(0, 20), secret)).toBeNull();
    expect(openSignIn(token, "another-secret-another-secret")).toBeNull();
    expect(openSignIn("not a token", secret)).toBeNull();
  });
});
