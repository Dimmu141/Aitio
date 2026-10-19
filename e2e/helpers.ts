import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Where the server under test writes outgoing emails (DEV_EMAIL_LOG_FILE). */
export const EMAIL_LOG = process.env.DEV_EMAIL_LOG_FILE ?? join(tmpdir(), "aitio-e2e-emails.jsonl");

/** Listed in ADMIN_EMAILS for the server under test; removed by the teardown like other test users. */
export const ADMIN_EMAIL = "admin-e2e@example.fi";

export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.fi`;
}

/** The latest sign-in email to `to`, retried while the server writes it. */
async function signInEmailFor(to: string): Promise<{ subject: string; text: string }> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const lines = (await readFile(EMAIL_LOG, "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
    const message = lines
      .map((line) => JSON.parse(line) as { to: string; subject: string; text: string })
      .reverse()
      .find((m) => m.to === to);
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No sign-in email for ${to} in ${EMAIL_LOG}`);
}

/** The sign-in link from the latest email to `to`. */
export async function magicLinkFor(to: string): Promise<string> {
  const link = (await signInEmailFor(to)).text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`No link in the sign-in email for ${to}`);
  return link;
}

/** The six-digit code from the latest sign-in email to `to`, as the subject shows it. */
export async function codeFor(to: string): Promise<string> {
  const code = (await signInEmailFor(to)).subject.match(/\b\d{6}\b/)?.[0];
  if (!code) throw new Error(`No code in the sign-in email for ${to}`);
  return code;
}

/** Sign in through the real flow: email form, link from the email, confirmation button. */
export async function signIn(page: Page, email: string): Promise<void> {
  await expect(page.getByRole("heading", { name: "Kirjaudu", exact: true })).toBeVisible();
  await page.getByLabel("Sähköpostiosoite").fill(email);
  await page.getByRole("button", { name: "Lähetä kirjautumiskoodi" }).click();
  await expect(page.getByRole("heading", { name: "Tarkista sähköpostisi" })).toBeVisible();
  await page.goto(await magicLinkFor(email));
  await page.getByRole("button", { name: "Kirjaudu sisään" }).click();
}

/**
 * On a signed-out "Merkitse nähdyksi" page: save, which keeps the entry as a draft and
 * asks to sign in, sign in, and land back on the form, prefilled from the draft.
 */
export async function signInFromLog(page: Page, email: string): Promise<void> {
  await page.getByRole("button", { name: "Tallenna" }).click();
  await expect(page.getByText("Merkintäsi on tallessa.")).toBeVisible();
  await signIn(page, email);
  await expect(page.getByText("Merkintäsi odotti kirjautumista.")).toBeVisible();
}

/** A made-up client IP, so every test gets its own rate-limit bucket like a real visitor would. */
export function randomIp(): string {
  const octet = () => 1 + Math.floor(Math.random() * 254);
  return `10.${octet()}.${octet()}.${octet()}`;
}
