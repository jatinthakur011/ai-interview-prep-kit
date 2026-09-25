import type { LLMClient } from "../llm/client.js";
import type { Question, Requirement } from "../domain/kit.js";
import { findUncoveredRequirements } from "./coverage.js";
import { generateQuestionsForRequirement, generateProcessQuestions } from "./generateQuestions.js";
import type { DiscussionFindings } from "./findDiscussion.js";

export interface QuestionBankResult {
  questions: Question[];
  uncoveredRequirementIds: string[];
  passes: number;
}

const MAX_PASSES = 3; // brief: decide how many passes are sensible and explain the choice.
// Rationale (also in README): pass 1 covers everything found normally; pass 2 targets
// whatever pass 1 missed; pass 3 is a final safety net for a flaky model reply. If a
// requirement is still uncovered after 3 tries, it is recorded honestly rather than
// looped on forever — an infinite retry would violate the free-tier rate-limit budget.

/**
 * The second-pass loop required by brief Section 4: generate an initial
 * draft, deterministically find gaps (coverage.ts — never the model's call),
 * regenerate only for the gaps, and repeat until covered or MAX_PASSES.
 */
export async function buildQuestionBank(
  requirements: Requirement[],
  jdText: string,
  hiringProcessText: string | null,
  discussion: DiscussionFindings,
  llm: LLMClient
): Promise<QuestionBankResult> {
  const perReqQuestions = new Map<string, Question[]>();
  let passes = 0;
  let pending = requirements;

  while (pending.length > 0 && passes < MAX_PASSES) {
    const results = await Promise.all(
      pending.map(async (req) => {
        try {
          return { req, qs: await generateQuestionsForRequirement(req, jdText, llm) };
        } catch {
          return { req, qs: [] as Question[] }; // one failed call must not abort the run
        }
      })
    );
    for (const { req, qs } of results) {
      if (qs.length) perReqQuestions.set(req.id, [...(perReqQuestions.get(req.id) ?? []), ...qs]);
    }
    passes++;

    const allQuestionsSoFar = [...perReqQuestions.values()].flat();
    pending = findUncoveredRequirements(requirements, allQuestionsSoFar);
  }

  const questions = [...perReqQuestions.values()].flat();
  let processQuestions: Question[] = [];
  try {
    processQuestions = await generateProcessQuestions(requirements, hiringProcessText, discussion, llm);
  } catch {
    processQuestions = []; // a failed process-question call degrades the kit, doesn't fail it
  }

  const finalQuestions = [...questions, ...processQuestions];
  const uncovered = findUncoveredRequirements(requirements, finalQuestions);

  return {
    questions: finalQuestions,
    uncoveredRequirementIds: uncovered.map((r) => r.id),
    passes,
  };
}
