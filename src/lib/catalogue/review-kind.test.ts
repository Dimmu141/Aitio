import { describe, expect, it } from "vitest";
import { reviewKind } from "./review-kind";

// Outlets and links as HKT, Ryhmäteatteri and Kansallisteatteri listed them on 18 Oct 2026.
describe("reviewKind", () => {
  it.each([
    ["Helsingin Sanomat", "https://hkt.fi/wp-content/uploads/arvio.pdf", "press"],
    ["Helsingin Sanomat", "https://www.hs.fi/kulttuuri/art-1.html", "press"],
    ["Apu.fi", "https://www.apu.fi/artikkelit/x", "press"],
    ["Svenska Yle", "https://hkt.fi/esitykset/julia/", "press"],
    ["Hufvudstadsbladet", "https://hkt.fi/x", "press"],
    ["Kansan Uutiset", "https://www.ku.fi/artikkeli/1", "press"],
    ["Etelä-Suomen Sanomat", "https://www.ess.fi/x", "press"],
    ["Apu-blogit", "https://www.apu.fi/blogit/x", "blog"],
    ["Sanasateen tekijä -blogi", "https://hkt.fi/x", "blog"],
    ["Liisan Seikkailut", "https://liisan-seikkailut.blogspot.com/2026/x", "blog"],
    ["Kielipuolen päiväkirja", "https://hkt.fi/x", "blog"],
    ["hannahelavuori.com", "https://hannahelavuori.com/x", "blog"],
  ])("%s", (outlet, url, expected) => {
    expect(reviewKind(outlet, url)).toBe(expected);
  });
});
