import { assertSafeUrl, UnsafeUrlError, type UrlSafetyOptions } from "./urlSafety.js";
import { fetchPage, type FetchPageOptions } from "./fetchPage.js";
import { extractFromHtml } from "./extractText.js";
import { parseRobots, allowAllRobots, type RobotsRules } from "./robots.js";
import { withRetry } from "../llm/retry.js";
import { LLMError } from "../llm/client.js";

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
}

export interface SkippedSource {
  url: string;
  reason: string;
}

export interface CrawlResult {
  homepage: CrawledPage | null;
  hiringPage: CrawledPage | null;
  pagesUsed: string[];
  skipped: SkippedSource[];
}

export interface CrawlOptions extends UrlSafetyOptions {
  fetchImpl?: typeof fetch;
  maxPages?: number;
  rateLimitMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

// Paths and anchor-text words that suggest "this link leads to how the company hires".
// A ranking signal, not a fixed list to fetch directly — the brief requires crawling
// and ranking, because the real page can live anywhere (/careers, /jobs, a handbook, a blog post).
const HIRING_SIGNALS = [
  "career", "careers", "jobs", "job", "hiring", "join-us", "join us", "work-with-us",
  "work with us", "our-process", "interview", "interview-process", "how-we-hire",
  "recruiting", "recruitment", "life-at", "team", "open-positions", "positions",
];

function score(href: string, text: string): number {
  const hay = `${href} ${text}`.toLowerCase();
  let s = 0;
  for (const sig of HIRING_SIGNALS) if (hay.includes(sig)) s += sig.includes("interview") || sig.includes("hire") ? 3 : 2;
  if (/interview/.test(hay)) s += 2;
  return s;
}

async function robotsFor(origin: string, opts: CrawlOptions): Promise<RobotsRules> {
  const outcome = await fetchPage(`${origin}/robots.txt`, opts);
  if (!outcome.ok) return allowAllRobots;
  try {
    return parseRobots(outcome.html);
  } catch {
    return allowAllRobots;
  }
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Crawls a company site starting from its homepage to find (a) what the
 * company does and (b) its hiring/interview-process page, if one exists.
 * Every link is ranked by how strongly it looks hiring-related; the
 * highest scorers are fetched and re-ranked by their own content. A fixed
 * path list is deliberately not used, per the brief.
 */
export async function crawlCompanySite(startUrl: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const skipped: SkippedSource[] = [];
  const pagesUsed: string[] = [];
  const sleep = opts.sleep ?? realSleep;
  const rateLimitMs = opts.rateLimitMs ?? 500;
  const maxPages = opts.maxPages ?? 4;

  let origin: URL;
  try {
    origin = assertSafeUrl(startUrl, opts);
  } catch (e) {
    skipped.push({ url: startUrl, reason: (e as UnsafeUrlError).message });
    return { homepage: null, hiringPage: null, pagesUsed, skipped };
  }

  const robots = await robotsFor(origin.origin, opts);
  const fetchOne = (url: string) =>
    withRetry(
      async () => {
        const r = await fetchPage(url, opts);
        if (!r.ok && (r.reason === "TIMEOUT" || r.reason === "NETWORK_ERROR" || r.reason === "HTTP_ERROR"))
          throw new LLMError(r.detail, true);
        return r;
      },
      { retries: 2, baseMs: 400, sleep: opts.sleep }
    ).catch(() => ({ ok: false as const, reason: "NETWORK_ERROR" as const, detail: `Failed after retries: ${url}` }));

  if (!robots.isAllowed(origin.pathname || "/")) {
    skipped.push({ url: origin.toString(), reason: "Disallowed by robots.txt" });
    return { homepage: null, hiringPage: null, pagesUsed, skipped };
  }

  const homeOutcome = await fetchOne(origin.toString());
  if (!homeOutcome.ok) {
    skipped.push({ url: origin.toString(), reason: homeOutcome.detail });
    return { homepage: null, hiringPage: null, pagesUsed, skipped };
  }
  const home = extractFromHtml(homeOutcome.html, homeOutcome.finalUrl);
  const homepage: CrawledPage = { url: homeOutcome.finalUrl, title: home.title, text: home.text };
  pagesUsed.push(homepage.url);

  const sameOrigin = home.links.filter((l) => {
    try {
      return new URL(l.href).origin === origin.origin;
    } catch {
      return false;
    }
  });

  const ranked = [...new Map(sameOrigin.map((l) => [l.href, l])).values()]
    .map((l) => ({ ...l, score: score(l.href, l.text) }))
    .filter((l) => l.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages);

  let hiringPage: CrawledPage | null = null;
  let bestScore = 0;

  for (const candidate of ranked) {
    await sleep(rateLimitMs);
    let u: URL;
    try {
      u = assertSafeUrl(candidate.href, opts);
    } catch (e) {
      skipped.push({ url: candidate.href, reason: (e as Error).message });
      continue;
    }
    if (!robots.isAllowed(u.pathname)) {
      skipped.push({ url: candidate.href, reason: "Disallowed by robots.txt" });
      continue;
    }
    const outcome = await fetchOne(candidate.href);
    if (!outcome.ok) {
      skipped.push({ url: candidate.href, reason: outcome.detail });
      continue;
    }
    pagesUsed.push(outcome.finalUrl);
    const page = extractFromHtml(outcome.html, outcome.finalUrl);
    const contentScore = candidate.score + (/interview|hiring process|our process/i.test(page.text) ? 3 : 0);
    if (contentScore > bestScore) {
      bestScore = contentScore;
      hiringPage = { url: outcome.finalUrl, title: page.title, text: page.text };
    }
  }

  return { homepage, hiringPage, pagesUsed, skipped };
}
