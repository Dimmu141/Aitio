import { describe, expect, it } from "vitest";
import { alternates, href, resolvePublicPath, switchLocalePath } from "./paths";

describe("href", () => {
  it("leaves Finnish unprefixed and translates segments", () => {
    expect(href("fi")).toBe("/");
    expect(href("sv")).toBe("/sv");
    expect(href("fi", "esitys", "nattland-svenska-teatern")).toBe("/esitys/nattland-svenska-teatern");
    expect(href("sv", "esitys", "nattland")).toBe("/sv/forestallning/nattland");
    expect(href("en", "teatteri", "kansallisteatteri")).toBe("/en/theatre/kansallisteatteri");
    expect(href("en", "henkilo", "kristian-smeds")).toBe("/en/person/kristian-smeds");
  });

  it("lists all three locales as alternates", () => {
    expect(alternates("henkilo", "a")).toEqual({ fi: "/henkilo/a", sv: "/sv/person/a", en: "/en/person/a" });
  });
});

describe("resolvePublicPath", () => {
  it.each([
    ["/", { kind: "rewrite", pathname: "/fi" }],
    ["/esitys/x", { kind: "rewrite", pathname: "/fi/esitys/x" }],
    ["/sv", { kind: "pass" }],
    ["/sv/forestallning/x", { kind: "rewrite", pathname: "/sv/esitys/x" }],
    ["/en/show/x", { kind: "rewrite", pathname: "/en/esitys/x" }],
    ["/en/theatre/x", { kind: "rewrite", pathname: "/en/teatteri/x" }],
    ["/sv/person/x", { kind: "rewrite", pathname: "/sv/henkilo/x" }],
    ["/fi/esitys/x", { kind: "redirect", pathname: "/esitys/x" }],
    ["/fi", { kind: "redirect", pathname: "/" }],
    ["/sv/esitys/x", { kind: "redirect", pathname: "/sv/forestallning/x" }],
    ["/en/henkilo/x", { kind: "redirect", pathname: "/en/person/x" }],
    ["/sv/okand", { kind: "pass" }],
  ] as const)("%s", (pathname, expected) => {
    expect(resolvePublicPath(pathname)).toEqual(expected);
  });

  it("round-trips every href", () => {
    for (const locale of ["fi", "sv", "en"] as const) {
      const result = resolvePublicPath(href(locale, "esitys", "x"));
      expect(result.kind).not.toBe("redirect");
    }
  });
});

describe("switchLocalePath", () => {
  it.each([
    ["/", "sv", "/sv"],
    ["/sv", "fi", "/"],
    ["/esitys/x", "en", "/en/show/x"],
    ["/sv/forestallning/x", "fi", "/esitys/x"],
    ["/en/theatre/kansallisteatteri", "sv", "/sv/teater/kansallisteatteri"],
    ["/sv/okand", "en", "/en"],
    // Internal paths, as usePathname() reports them on prerendered pages.
    ["/fi/esitys/x", "en", "/en/show/x"],
    ["/fi", "sv", "/sv"],
    ["/sv/esitys/x", "fi", "/esitys/x"],
    ["/en/teatteri/y", "sv", "/sv/teater/y"],
  ] as const)("%s → %s", (pathname, target, expected) => {
    expect(switchLocalePath(pathname, target)).toBe(expected);
  });
});
