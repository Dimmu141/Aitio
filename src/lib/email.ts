import { appendFile } from "node:fs/promises";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Extra headers, e.g. List-Unsubscribe on the digest. */
  headers?: Record<string, string>;
}

/** "Aitio <kirjaudu@aitio.fi>" → its parts; Brevo wants them separately. */
export function parseSender(value: string): { name?: string; email: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { ...(match[1] ? { name: match[1].replace(/^"|"$/g, "") } : {}), email: match[2] } : { email: value.trim() };
}

function sender(): string {
  return process.env.EMAIL_FROM ?? "Aitio <kirjaudu@aitio.fi>";
}

/**
 * Brevo (EU, the launch choice) when BREVO_API_KEY is set, else Resend when
 * RESEND_API_KEY is. Without either, development and the e2e tests (via
 * DEV_EMAIL_LOG_FILE) get the message in the console or a file; production refuses,
 * so a missing key can't silently swallow sign-in links.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (process.env.BREVO_API_KEY) return sendWithBrevo(message, process.env.BREVO_API_KEY);
  if (process.env.RESEND_API_KEY) return sendWithResend(message, process.env.RESEND_API_KEY);

  const logFile = process.env.DEV_EMAIL_LOG_FILE;
  if (logFile && process.env.VERCEL_ENV !== "production") {
    await appendFile(logFile, `${JSON.stringify(message)}\n`);
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("No email provider key (BREVO_API_KEY) is set");
  console.info(`\n[email to ${message.to}] ${message.subject}\n${message.text}\n`);
}

/** The JSON body for Brevo's POST /v3/smtp/email; exported for the tests. */
export function brevoBody(message: EmailMessage, from = sender()) {
  return {
    sender: parseSender(from),
    to: [{ email: message.to }],
    subject: message.subject,
    textContent: message.text,
    ...(message.headers ? { headers: message.headers } : {}),
  };
}

async function sendWithBrevo(message: EmailMessage, apiKey: string): Promise<void> {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(brevoBody(message)),
  });
  if (!response.ok) throw new Error(`Brevo answered ${response.status}: ${await response.text()}`);
}

async function sendWithResend(message: EmailMessage, apiKey: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: sender(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      headers: message.headers,
    }),
  });
  if (!response.ok) throw new Error(`Resend answered ${response.status}: ${await response.text()}`);
}

/** Gap between bulk sends: Resend allows 2 requests a second by default, Brevo far more. */
export function bulkPauseMs(): number {
  return !process.env.BREVO_API_KEY && process.env.RESEND_API_KEY ? 550 : 0;
}
