/**
 * Checks a production environment before launch: `pnpm launch:check <env file>`, e.g.
 * after `vercel env pull .env.production.local --environment=production`.
 * Errors would break something; warnings are choices worth a second look.
 */
export interface Finding {
  level: "error" | "warning";
  variable: string;
  message: string;
}

type Env = Record<string, string | undefined>;
type Check = (env: Env) => Finding[];

const error = (variable: string, message: string): Finding => ({ level: "error", variable, message });
const warning = (variable: string, message: string): Finding => ({ level: "warning", variable, message });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function url(value: string | undefined): URL | null {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function isLocal(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
}

function secret(name: string, min: number): Check {
  return (env) => {
    const value = env[name];
    if (!value) return [error(name, "missing")];
    return value.length < min ? [error(name, `shorter than ${min} characters; generate with: openssl rand -base64 32`)] : [];
  };
}

const database: Check = (env) => {
  const parsed = url(env.DATABASE_URL);
  if (!parsed) return [error("DATABASE_URL", "missing or not a URL")];
  if (isLocal(parsed.hostname)) return [error("DATABASE_URL", "points at this machine")];
  return parsed.searchParams.get("sslmode") === "require" || parsed.searchParams.get("sslmode") === "verify-full"
    ? []
    : [warning("DATABASE_URL", "no sslmode=require; hosted databases (Neon) need TLS")];
};

const site: Check = (env) => {
  const parsed = url(env.SITE_URL);
  if (!parsed) return [error("SITE_URL", "missing: canonical URLs, sitemap and email links would point at localhost")];
  const findings: Finding[] = [];
  if (parsed.protocol !== "https:" || isLocal(parsed.hostname)) findings.push(error("SITE_URL", "must be the public https:// address"));
  const auth = url(env.BETTER_AUTH_URL);
  if (env.BETTER_AUTH_URL && auth?.origin !== parsed.origin) {
    findings.push(error("BETTER_AUTH_URL", "differs from SITE_URL; leave it unset to use SITE_URL"));
  }
  return findings;
};

const email: Check = (env) => {
  const findings: Finding[] = [];
  if (!env.BREVO_API_KEY && !env.RESEND_API_KEY) findings.push(error("BREVO_API_KEY", "no email provider: nobody could sign in"));
  else if (!env.BREVO_API_KEY) findings.push(warning("RESEND_API_KEY", "Resend is a US provider; the privacy policy names Brevo"));
  if (!env.EMAIL_FROM) findings.push(warning("EMAIL_FROM", "unset; defaults to kirjaudu@aitio.fi, which must be a verified sender"));
  const siteHost = url(env.SITE_URL)?.hostname.replace(/^www\./, "");
  const fromDomain = env.EMAIL_FROM?.match(/@([^>\s]+)/)?.[1];
  if (siteHost && fromDomain && !fromDomain.endsWith(siteHost)) {
    findings.push(warning("EMAIL_FROM", `sends from ${fromDomain}, not ${siteHost}; set up SPF, DKIM and DMARC for it`));
  }
  if (env.DEV_EMAIL_LOG_FILE) findings.push(error("DEV_EMAIL_LOG_FILE", "set in production; remove it"));
  if (!env.EMAIL_WEBHOOK_SECRET) {
    findings.push(warning("EMAIL_WEBHOOK_SECRET", "unset: bounces and spam complaints won't stop the weekly email"));
  }
  return findings;
};

const people: Check = (env) => {
  const findings: Finding[] = [];
  const admins = (env.ADMIN_EMAILS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (admins.length === 0) findings.push(warning("ADMIN_EMAILS", "nobody gets scrape alerts or sees /yllapito"));
  for (const admin of admins) if (!EMAIL.test(admin)) findings.push(error("ADMIN_EMAILS", `not an email address: ${admin}`));
  if (!env.PRIVACY_CONTROLLER) findings.push(error("PRIVACY_CONTROLLER", "the privacy policy must name the controller"));
  if (!env.PRIVACY_EMAIL || !EMAIL.test(env.PRIVACY_EMAIL)) findings.push(error("PRIVACY_EMAIL", "the privacy policy needs a contact address"));
  return findings;
};

/** The theatres should be able to reach whoever runs the bot. */
const scraper: Check = (env) => {
  const agent = env.SCRAPER_USER_AGENT ?? "";
  if (!agent) return [error("SCRAPER_USER_AGENT", "missing: the scraper must say who it is")];
  return /example\.|you@/.test(agent) || !/@|https?:\/\//.test(agent)
    ? [error("SCRAPER_USER_AGENT", "needs a real contact address or URL, not the example one")]
    : [];
};

const CHECKS: Check[] = [
  scraper,
  database,
  site,
  secret("BETTER_AUTH_SECRET", 32),
  secret("CRON_SECRET", 16),
  secret("REVALIDATE_SECRET", 16),
  email,
  people,
];

export function checkLaunchEnv(env: Env): Finding[] {
  return CHECKS.flatMap((check) => check(env));
}
