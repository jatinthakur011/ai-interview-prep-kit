import type { LLMClient } from "../llm/client.js";
import type { DiscussionSearchClient } from "../discussion/client.js";
import type { Kit, Question } from "../domain/kit.js";
import { validateKit } from "../domain/validateKit.js";
import { crawlCompanySite } from "../fetch/crawler.js";
import { findInterviewDiscussion } from "./findDiscussion.js";
import { generateQuestionsForRequirement, generateProcessQuestions } from "./generateQuestions.js";
import { findUncoveredRequirements } from "./coverage.js";
import { generateCompanyBrief } from "./generateCompanyBrief.js";
import { allocateSchedule } from "./scheduler.js";
import { KitGenerationError } from "./generateKit.js";

export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";
export type RegenerateTarget = "company_brief" | "schedule" | QuestionCategory;

export interface RegenerateOptions {
  target: RegenerateTarget;
  jd: string;
  llm: LLMClient;
  discussion: DiscussionSearchClient | null;
  allowLocalFetch?: boolean;
  /** Only used when target === "schedule": override the number of days. Defaults to the kit's current value. */
  daysOverride?: number;
}

const CATEGORY_BY_KIND: Record<string, QuestionCategory> = {
  technical: "technical",
  behavioural: "behavioural",
  domain: "company-fit",
};
const MAX_PASSES = 3;

/**
 * Regenerates exactly one section of an existing kit. The other sections —
 * and any question/flashcard the user has edited or added by hand within
 * the section itself — pass through untouched, per brief Section 6: "a
 * question the user wrote or edited by hand must survive a regeneration of
 * its category".
 */
export async function regenerateSection(kit: Kit, opts: RegenerateOptions): Promise<Kit> {
  if (opts.target === "company_brief") return regenerateBrief(kit, opts);
  if (opts.target === "schedule") return regenerateSchedule(kit, opts);
  return regenerateQuestionCategory(kit, opts.target, opts);
}

async function regenerateBrief(kit: Kit, opts: RegenerateOptions): Promise<Kit> {
  const crawl = await crawlCompanySite(kit.source.company_url, { allowLocal: opts.allowLocalFetch }).catch(() => ({
    homepage: null,
    hiringPage: null,
    pagesUsed: kit.source.pages_used,
    skipped: [],
  }));
  const discussionFindings = await findInterviewDiscussion(kit.source.company, opts.discussion);
  const brief = await generateCompanyBrief(
    kit.source.company,
    crawl.homepage?.text ?? null,
    crawl.homepage?.url ?? null,
    crawl.hiringPage?.text ?? null,
    crawl.hiringPage?.url ?? null,
    opts.llm
  );
  const sources = [...new Set([...brief.sources, ...discussionFindings.sources])];
  return finalize({
    ...kit,
    company_brief: { summary: brief.summary, what_they_do: brief.what_they_do, sources },
    source: { ...kit.source, pages_used: [...new Set([...kit.source.pages_used, ...crawl.pagesUsed])] },
  });
}

async function regenerateSchedule(kit: Kit, opts: RegenerateOptions): Promise<Kit> {
  const days = opts.daysOverride ?? kit.schedule.days_available;
  const schedule = allocateSchedule(kit.questions, kit.role.requirements, days);
  return finalize({ ...kit, schedule });
}

async function regenerateQuestionCategory(kit: Kit, category: QuestionCategory, opts: RegenerateOptions): Promise<Kit> {
  const pinned = kit.questions.filter((q) => q.category === category && q.origin !== "generated");
  const untouched = kit.questions.filter((q) => q.category !== category);
  const pinnedCoveredIds = new Set(pinned.flatMap((q) => q.requirement_ids));

  let freshQuestions: Question[] = [];
  if (category === "system-design") {
    const crawl = await crawlCompanySite(kit.source.company_url, { allowLocal: opts.allowLocalFetch }).catch(() => ({
      homepage: null,
      hiringPage: null,
      pagesUsed: [],
      skipped: [],
    }));
    const discussionFindings = await findInterviewDiscussion(kit.source.company, opts.discussion);
    try {
      freshQuestions = await generateProcessQuestions(
        kit.role.requirements,
        crawl.hiringPage?.text ?? null,
        discussionFindings,
        opts.llm
      );
    } catch (e) {
      throw new KitGenerationError("Regenerating process questions failed", "REGEN_FAILED", e);
    }
  } else {
    const targetRequirements = kit.role.requirements.filter(
      (r) => CATEGORY_BY_KIND[r.kind] === category && !pinnedCoveredIds.has(r.id)
    );
    const perReq = new Map<string, Question[]>();
    let pending = targetRequirements;
    let passes = 0;
    while (pending.length > 0 && passes < MAX_PASSES) {
      const results = await Promise.all(
        pending.map(async (req) => {
          try {
            return { req, qs: await generateQuestionsForRequirement(req, kit.source.role, opts.llm) };
          } catch {
            return { req, qs: [] as Question[] };
          }
        })
      );
      for (const { req, qs } of results) if (qs.length) perReq.set(req.id, [...(perReq.get(req.id) ?? []), ...qs]);
      passes++;
      pending = findUncoveredRequirements(targetRequirements, [...perReq.values()].flat());
    }
    freshQuestions = [...perReq.values()].flat();
  }

  const questions = [...untouched, ...pinned, ...freshQuestions];
  const uncovered = findUncoveredRequirements(kit.role.requirements, questions);
  return finalize({
    ...kit,
    questions,
    coverage: { uncovered_requirement_ids: uncovered.map((r) => r.id), passes: kit.coverage.passes + 1 },
  });
}

function finalize(candidate: Kit): Kit {
  // A regenerated question set can leave the schedule referencing question
  // ids that no longer exist (they were replaced with fresh ones). Drop
  // only those dangling references rather than rebuilding the whole
  // schedule, so a person's manual day-by-day arrangement survives; minutes
  // are recomputed for what remains on each day.
  const qById = new Map(candidate.questions.map((q) => [q.id, q]));
  const minutesByDifficulty: Record<number, number> = { 1: 10, 2: 15, 3: 20 };
  const schedule = {
    ...candidate.schedule,
    days: candidate.schedule.days.map((d) => {
      const ids = d.question_ids.filter((id) => qById.has(id));
      // Recompute minutes from whatever remains on this day. If every question on
      // the day was replaced (ids is empty), the day now has 0 scheduled minutes
      // rather than silently keeping the old total for questions that no longer exist.
      const minutes = ids.reduce((sum, id) => sum + (minutesByDifficulty[qById.get(id)!.difficulty] ?? 15), 0);
      return { ...d, question_ids: ids, minutes };
    }),
  };
  const kit = { ...candidate, schedule };

  const result = validateKit(kit);
  if (!result.ok) throw new KitGenerationError(`Regenerated kit failed validation: ${result.errors.join("; ")}`, "INVALID_KIT");
  return result.kit;
}
