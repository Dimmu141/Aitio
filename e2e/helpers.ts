import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Where the server under test writes outgoing emails (DEV_EMAIL_LOG_FILE). */
export const EMAIL_LOG = process.env.DEV_EMAIL_LOG_FILE ?? join(tmpdir(), "aitio-e2e-emails.jsonl");

export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.fi`;
}

/** The sign-in link from the latest email to `to`, retried while the server writes it. */
export async function magicLinkFor(to: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const lines = (await readFile(EMAIL_LOG, "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
    const message = lines.map((line) => JSON.parse(line) as { to: string; text: string }).reverse().find((m) => m.to === to);
    const link = message?.text.match(/https?:\/\/\S+/)?.[0];
    if (link) return link;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No sign-in email for ${to} in ${EMAIL_LOG}`);
}

/** Sign in through the real flow: email form, link from the email, confirmation button. */
export async function signIn(page: Page, email: string): Promise<void> {
  await expect(page.getByRole("heading", { name: "Kirjaudu", exact: true })).toBeVisible();
  await page.getByLabel("Sähköpostiosoite").fill(email);
  await page.getByRole("button", { name: "Lähetä kirjautumislinkki" }).click();
  await expect(page.getByRole("heading", { name: "Tarkista sähköpostisi" })).toBeVisible();
  await page.goto(await magicLinkFor(email));
  await page.getByRole("button", { name: "Kirjaudu sisään" }).click();
}

/** A made-up client IP, so every test gets its own rate-limit bucket like a real visitor would. */
export function randomIp(): string {
  const octet = () => 1 + Math.floor(Math.random() * 254);
  return `10.${octet()}.${octet()}.${octet()}`;
}
