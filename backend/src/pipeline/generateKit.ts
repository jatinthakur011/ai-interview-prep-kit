import type { LLMClient } from "../llm/client.js";
import type { DiscussionSearchClient } from "../discussion/client.js";
import type { Kit } from "../domain/kit.js";
import { validateKit } from "../domain/validateKit.js";
import { extractRequirements, ExtractionError } from "./extractRequirements.js";
import { crawlCompanySite, type CrawlResult, type SkippedSource } from "../fetch/crawler.js";
import { findInterviewDiscussion } from "./findDiscussion.js";
import { buildQuestionBank } from "./buildQuestionBank.js";
import { generateFlashcards } from "./generateFlashcards.js";
import { generateCompanyBrief } from "./generateCompanyBrief.js";
import { allocateSchedule } from "./scheduler.js";

export interface GenerateKitOptions {
  jd: string;
  companyUrl: string;
  days: number;
  llm: LLMClient;
  discussion: DiscussionSearchClient | null;
  /** Set true only for the batch CLI / tests, which serve company sites from localhost (Appendix B). */
  allowLocalFetch?: boolean;
}

export interface GenerateKitResult {
  kit: Kit;
  skippedSources: SkippedSource[];
}

export class KitGenerationError extends Error {
  constructor(message: string, public readonly code: string, public readonly cause?: unknown) {
    super(message);
    this.name = "KitGenerationError";
  }
}

function companyNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0];
  } catch {
    return "";
  }
}

/**
 * The single pipeline every entry point (HTTP API and the batch CLI) calls.
 * The steps run in the deliberate order the brief describes (Section 3):
 * extract what the posting says is needed, THEN crawl the company (a
 * homepage needs crawling before it's useful, and a hiring-process page,
 * once found, changes what questions make sense), THEN look for public
 * discussion, THEN generate + close coverage gaps, THEN derive flashcards
 * and allocate the schedule — the last two are pure arithmetic/derivation,
 * never handed to the model.
 */
export async function generateKit(opts: GenerateKitOptions): Promise<GenerateKitResult> {
  const { jd, companyUrl, days, llm, discussion } = opts;

  let extraction;
  try {
    extraction = await extractRequirements(jd, llm);
  } catch (e) {
    if (e instanceof ExtractionError) throw new KitGenerationError(e.message, e.code, e);
    const detail = e instanceof Error ? e.message : String(e);
    throw new KitGenerationError(`Requirement extraction failed: ${detail}`, "EXTRACTION_FAILED", e);
  }

  let crawl: CrawlResult = { homepage: null, hiringPage: null, pagesUsed: [], skipped: [] };
  try {
    crawl = await crawlCompanySite(companyUrl, { allowLocal: opts.allowLocalFetch });
  } catch (e) {
    // crawlCompanySite already catches almost everything internally and
    // reports via `skipped`; this is a last-resort net so a crawler bug
    // degrades the kit instead of failing it outright (Section 2/10).
    crawl.skipped.push({ url: companyUrl, reason: (e as Error).message ?? "Unknown crawl failure" });
  }

  const company = extraction.company || companyNameFromUrl(companyUrl);

  const discussionFindings = await findInterviewDiscussion(company, discussion);

  const { questions, uncoveredRequirementIds, passes } = await buildQuestionBank(
    extraction.requirements,
    jd,
    crawl.hiringPage?.text ?? null,
    discussionFindings,
    llm
  );

  const flashcards = generateFlashcards(extraction.requirements, questions);

  const schedule = allocateSchedule(questions, extraction.requirements, days);

  const brief = await generateCompanyBrief(
    company,
    crawl.homepage?.text ?? null,
    crawl.homepage?.url ?? null,
    crawl.hiringPage?.text ?? null,
    crawl.hiringPage?.url ?? null,
    llm
  );
  // Public-discussion sources strengthen the brief's provenance even when
  // they didn't independently justify a full re-summarisation call.
  const briefSources = [...new Set([...brief.sources, ...discussionFindings.sources])];

  const assembled: Kit = {
    source: {
      company,
      company_url: companyUrl,
      role: extraction.title,
      location: extraction.location,
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: crawl.pagesUsed,
    },
    company_brief: { summary: brief.summary, what_they_do: brief.what_they_do, sources: briefSources },
    role: {
      title: extraction.title,
      seniority: extraction.seniority,
      responsibilities: extraction.responsibilities,
      requirements: extraction.requirements,
    },
    questions,
    flashcards,
    schedule,
    coverage: { uncovered_requirement_ids: uncoveredRequirementIds, passes },
  };

  const result = validateKit(assembled);
  if (!result.ok) {
    throw new KitGenerationError(`Generated kit failed structural validation: ${result.errors.join("; ")}`, "INVALID_KIT");
  }

  return { kit: result.kit, skippedSources: crawl.skipped };
}
