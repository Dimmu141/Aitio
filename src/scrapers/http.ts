import robotsParser from "robots-parser";
import { userAgent } from "./agent";

export const USER_AGENT = userAgent(process.env);

const MIN_INTERVAL_MS = Number(process.env.SCRAPER_MIN_INTERVAL_MS ?? 1000);

type Robots = ReturnType<typeof robotsParser>;

const robotsCache = new Map<string, Promise<Robots | null>>();
const lastRequestAt = new Map<string, number>();

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

export class HttpError extends Error {
  constructor(
    url: string,
    readonly status: number,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

async function loadRobots(origin: string): Promise<Robots | null> {
  const robotsUrl = `${origin}/robots.txt`;
  try {
    const response = await rawFetch(robotsUrl);
    if (!response.ok) return null;
    return robotsParser(robotsUrl, await response.text());
  } catch {
    return null;
  }
}

async function waitForSlot(host: string): Promise<void> {
  const previous = lastRequestAt.get(host) ?? 0;
  const wait = previous + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt.set(host, Date.now());
}

async function rawFetch(url: string, form?: Record<string, string>): Promise<Response> {
  await waitForSlot(new URL(url).host);
  return fetch(url, {
    method: form ? "POST" : "GET",
    body: form ? new URLSearchParams(form) : undefined,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "fi,sv;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });
}

/**
 * Polite fetch: checks robots.txt (cached per origin), waits at least
 * MIN_INTERVAL_MS between requests to the same host, sends our User-Agent.
 * `form` sends a read-only POST, for sites whose own pages load content that way
 * (WordPress admin-ajax.php); the same robots.txt and rate rules apply.
 */
export async function politeFetch(url: string, form?: Record<string, string>): Promise<string> {
  const { origin } = new URL(url);
  if (!robotsCache.has(origin)) robotsCache.set(origin, loadRobots(origin));
  const robots = await robotsCache.get(origin);
  if (robots && robots.isAllowed(url, USER_AGENT) === false) {
    throw new RobotsDisallowedError(url);
  }
  const response = await rawFetch(url, form);
  if (!response.ok) throw new HttpError(url, response.status);
  return response.text();
}
