import { appendFile } from "node:fs/promises";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Extra headers, e.g. List-Unsubscribe on the digest. */
  headers?: Record<string, string>;
}

/**
 * Send through Resend's HTTP API when RESEND_API_KEY is set. Without it, development
 * (and the e2e tests, via DEV_EMAIL_LOG_FILE) get the message in the console or a file;
 * production refuses, so a missing key can't silently swallow sign-in links.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) return sendWithResend(message, apiKey);

  const logFile = process.env.DEV_EMAIL_LOG_FILE;
  if (logFile && process.env.VERCEL_ENV !== "production") {
    await appendFile(logFile, `${JSON.stringify(message)}\n`);
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set");
  console.info(`\n[email to ${message.to}] ${message.subject}\n${message.text}\n`);
}

async function sendWithResend(message: EmailMessage, apiKey: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Aitio <kirjaudu@aitio.fi>",
      to: message.to,
      subject: message.subject,
      text: message.text,
      headers: message.headers,
    }),
  });
  if (!response.ok) throw new Error(`Resend answered ${response.status}: ${await response.text()}`);
}
