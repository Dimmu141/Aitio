import { describe, expect, it } from "vitest";
import { brevoBody, parseSender } from "./email";

describe("parseSender", () => {
  it("splits a display name from the address", () => {
    expect(parseSender("Aitio <kirjaudu@aitio.fi>")).toEqual({ name: "Aitio", email: "kirjaudu@aitio.fi" });
    expect(parseSender('"Aitio, uutiset" <uutiset@aitio.fi>')).toEqual({ name: "Aitio, uutiset", email: "uutiset@aitio.fi" });
    expect(parseSender(" kirjaudu@aitio.fi ")).toEqual({ email: "kirjaudu@aitio.fi" });
  });
});

describe("brevoBody", () => {
  it("sends plain text with the unsubscribe headers", () => {
    const body = brevoBody(
      { to: "a@example.fi", subject: "Hei", text: "Teksti", headers: { "List-Unsubscribe": "<https://aitio.fi/x>" } },
      "Aitio <uutiset@aitio.fi>",
    );
    expect(body).toEqual({
      sender: { name: "Aitio", email: "uutiset@aitio.fi" },
      to: [{ email: "a@example.fi" }],
      subject: "Hei",
      textContent: "Teksti",
      headers: { "List-Unsubscribe": "<https://aitio.fi/x>" },
    });
    expect(brevoBody({ to: "a@example.fi", subject: "Hei", text: "T" }, "x@aitio.fi")).not.toHaveProperty("headers");
  });
});
