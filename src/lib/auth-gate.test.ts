import { describe, expect, it } from "vitest";
import { signInRedirect } from "./auth-gate";

describe("signInRedirect", () => {
  it("sends personal pages to sign in, keeping the public URL as next", () => {
    expect(signInRedirect("/fi/paivakirja", "/paivakirja", false)).toBe("/kirjaudu?next=%2Fpaivakirja");
    expect(signInRedirect("/sv/merkitse/x", "/sv/markera/x?entry=1", false)).toBe(
      "/sv/logga-in?next=%2Fsv%2Fmarkera%2Fx%3Fentry%3D1",
    );
  });

  it("lets a signed-out visitor fill in a new entry, but not edit one", () => {
    expect(signInRedirect("/fi/merkitse/x", "/merkitse/x", false)).toBeNull();
    expect(signInRedirect("/fi/merkitse/x", "/merkitse/x?entry=abc", false)).toBe("/kirjaudu?next=%2Fmerkitse%2Fx%3Fentry%3Dabc");
  });

  it("lets everything through with a session cookie", () => {
    expect(signInRedirect("/fi/paivakirja", "/paivakirja", true)).toBeNull();
  });

  it("leaves public pages alone", () => {
    expect(signInRedirect("/fi/esitys/x", "/esitys/x", false)).toBeNull();
    expect(signInRedirect("/fi/kirjaudu", "/kirjaudu", false)).toBeNull();
    expect(signInRedirect("/fi", "/", false)).toBeNull();
  });
});
