import type { DiscussionSearchClient } from "../discussion/client.js";

export interface DiscussionFindings {
  found: boolean;
  summary: string;
  sources: string[];
}

const DISCUSSION_HOSTS_HINT = ["glassdoor", "reddit", "blind", "levels.fyi", "leetcode", "medium", "quora"];

function relevance(company: string, r: { title: string; url: string; snippet: string }): number {
  const hay = `${r.title} ${r.url} ${r.snippet}`.toLowerCase();
  let s = 0;
  if (hay.includes(company.toLowerCase())) s += 2;
  if (/interview/.test(hay)) s += 2;
  if (DISCUSSION_HOSTS_HINT.some((h) => r.url.toLowerCase().includes(h))) s += 1;
  return s;
}

/**
 * Looks for public discussion of a company's interview process (brief
 * Section 2/3). Absence is a valid, honest outcome — not an error — per
 * Section 10 ("public discussion turns up nothing at all").
 */
export async function findInterviewDiscussion(
  company: string,
  client: DiscussionSearchClient | null
): Promise<DiscussionFindings> {
  if (!company.trim() || !client) return { found: false, summary: "", sources: [] };

  let results: Awaited<ReturnType<DiscussionSearchClient["search"]>>;
  try {
    results = await client.search(`${company} interview process questions experience`);
  } catch {
    // A search-provider failure is a skip, not a pipeline failure (Section 2: "skip and report").
    return { found: false, summary: "", sources: [] };
  }

  const ranked = results
    .map((r) => ({ ...r, score: relevance(company, r) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (ranked.length === 0) return { found: false, summary: "", sources: [] };

  const summary = ranked.map((r) => `${r.title}: ${r.snippet}`).join("\n");
  return { found: true, summary, sources: ranked.map((r) => r.url) };
}
