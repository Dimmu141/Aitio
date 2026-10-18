import { test as base } from "@playwright/test";
import { randomIp } from "./helpers";

/** Each test acts as a different visitor (own IP), as Vercel would report it. */
export const test = base.extend({
  // Named `provide`, not `use`, so the React hooks lint rule doesn't mistake it for a hook.
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": randomIp() });
  },
});

export { expect } from "@playwright/test";
