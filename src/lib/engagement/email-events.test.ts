import { describe, expect, it } from "vitest";
import { addressesToStop } from "./email-events";

describe("addressesToStop", () => {
  it("stops on hard bounces, spam complaints, invalid and blocked addresses", () => {
    for (const event of ["hard_bounce", "spam", "invalid_email", "blocked", "unsubscribed"]) {
      expect(addressesToStop({ event, email: "a@example.fi", id: 1 })).toEqual(["a@example.fi"]);
    }
  });

  it("ignores soft bounces, deliveries and junk", () => {
    expect(addressesToStop({ event: "soft_bounce", email: "a@example.fi" })).toEqual([]);
    expect(addressesToStop({ event: "delivered", email: "a@example.fi" })).toEqual([]);
    expect(addressesToStop(null)).toEqual([]);
    expect(addressesToStop("hard_bounce")).toEqual([]);
  });

  it("reads batched deliveries", () => {
    const batch = [
      { event: "hard_bounce", email: "a@example.fi" },
      { event: "delivered", email: "b@example.fi" },
      { event: "spam", email: "c@example.fi" },
    ];
    expect(addressesToStop(batch)).toEqual(["a@example.fi", "c@example.fi"]);
  });
});
