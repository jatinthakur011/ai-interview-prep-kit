import { LLMError } from "../llm/client.js";
import { withRetry, type RetryOptions } from "../llm/retry.js";
import type { DiscussionResult, DiscussionSearchClient } from "./client.js";

/**
 * Brave Search API adapter (genuine free tier: 2,000 queries/month, no card
 * required — https://brave.com/search/api/). Swappable: implement
 * DiscussionSearchClient against any other provider without touching callers.
 */
export interface BraveSearchOptions {
  apiKey: string;
  retry?: RetryOptions;
  fetchImpl?: typeof fetch;
}

export function createBraveSearchClient(opts: BraveSearchOptions): DiscussionSearchClient {
  const doFetch = opts.fetchImpl ?? fetch;

  async function callOnce(query: string): Promise<DiscussionResult[]> {
    let res: Response;
    try {
      res = await doFetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`, {
        headers: { accept: "application/json", "x-subscription-token": opts.apiKey },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new LLMError(`Network error calling Brave Search: ${(e as Error).message}`, true);
    }
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      throw new LLMError(`Brave Search HTTP ${res.status}`, retryable);
    }
    const data: any = await res.json();
    const results = data?.web?.results ?? [];
    return results.map((r: any) => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      snippet: String(r.description ?? "").replace(/<\/?strong>/g, ""),
    }));
  }

  return { search: (query) => withRetry(() => callOnce(query), opts.retry) };
}

export function createDiscussionClientFromEnv(env = process.env): DiscussionSearchClient | null {
  const apiKey = env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return null; // absence is not fatal: caller reports "no public discussion found"
  return createBraveSearchClient({ apiKey });
}
