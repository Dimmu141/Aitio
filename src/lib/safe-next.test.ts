import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each([
    ["/paivakirja", "/paivakirja"],
    ["/sv/markera/nattland?entry=1", "/sv/markera/nattland?entry=1"],
    ["//evil.example/x", "/"],
    ["https://evil.example", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    ["", "/"],
    [null, "/"],
  ])("%s → %s", (value, expected) => {
    expect(safeNext(value, "/")).toBe(expected);
  });
});
