import { z } from "zod";
import type { LLMClient } from "../llm/client.js";
import { parseJsonLoose } from "../llm/json.js";
import type { Question, Requirement } from "../domain/kit.js";
import type { DiscussionFindings } from "./findDiscussion.js";

const RawQuestionSchema = z.object({
  prompt: z.string().min(1),
  answer_outline: z.string(),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]),
  difficulty: z.number().int().min(1).max(3),
});
const RawBatchSchema = z.object({ questions: z.array(RawQuestionSchema).catch([]) });

/**
 * Requirement kind decides the default question category (brief Section 3:
 * "five years of React leads to technical questions while mentoring junior
 * engineers leads to behavioural ones — the two should not come from the
 * same call with the same instructions"). Each call below is scoped to one
 * requirement's own kind so the prompts genuinely differ.
 */
const CATEGORY_BY_KIND = { technical: "technical", behavioural: "behavioural", domain: "company-fit" } as const;

function systemPromptFor(category: string): string {
  const shared = `You write interview-preparation questions for a candidate. Return ONLY JSON:
{"questions":[{"prompt":"","answer_outline":"","category":"${category}","difficulty":2}]}
difficulty is an integer 1-3. Write 1-3 questions. answer_outline is a short (2-4 sentence) outline of what a strong answer covers, not a full answer.`;

  const byCategory: Record<string, string> = {
    technical: `${shared}\nFocus: hands-on technical questions that probe real depth on the specific requirement given (not generic trivia).`,
    behavioural: `${shared}\nFocus: behavioural/STAR-style questions about how the candidate has actually handled this kind of situation before.`,
    "system-design": `${shared}\nFocus: a system-design or take-home-style question consistent with the company's described interview process.`,
    "company-fit": `${shared}\nFocus: why-this-company / domain-fit questions tied to what the company actually does.`,
  };
  return byCategory[category] ?? shared;
}

async function callForCategory(
  llm: LLMClient,
  category: string,
  userPrompt: string
): Promise<z.infer<typeof RawQuestionSchema>[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await llm.generateJson({
      system: systemPromptFor(category),
      user: attempt === 0 ? userPrompt : `${userPrompt}\n\nReply with ONLY the JSON object, no other text.`,
      temperature: 0.4,
    });
    try {
      const parsed = RawBatchSchema.safeParse(parseJsonLoose(raw));
      if (parsed.success && parsed.data.questions.length > 0) return parsed.data.questions;
    } catch {
      /* try repair prompt */
    }
  }
  return [];
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}${++counter}`;
export const resetQuestionIdCounter = () => { counter = 0; };

/** Generates questions for one requirement, in its own model call with a category-specific prompt. */
export async function generateQuestionsForRequirement(
  requirement: Requirement,
  jdContext: string,
  llm: LLMClient
): Promise<Question[]> {
  const category = CATEGORY_BY_KIND[requirement.kind];
  const userPrompt = `Requirement: "${requirement.text}" (priority: ${requirement.priority})\nRelevant context from the job description:\n${jdContext.slice(0, 800)}`;
  const raw = await callForCategory(llm, category, userPrompt);
  return raw.map((q) => ({
    id: nextId("q"),
    requirement_ids: [requirement.id],
    category: q.category,
    prompt: q.prompt.trim(),
    answer_outline: q.answer_outline.trim(),
    difficulty: q.difficulty,
    origin: "generated" as const,
  }));
}

/** Generates system-design / company-fit questions shaped by the hiring page and public discussion, when found. */
export async function generateProcessQuestions(
  requirements: Requirement[],
  hiringProcessText: string | null,
  discussion: DiscussionFindings,
  llm: LLMClient
): Promise<Question[]> {
  if (!hiringProcessText && !discussion.found) return [];
  const category = "system-design" as const;
  const context = [
    hiringProcessText ? `Hiring page describes this process:\n${hiringProcessText.slice(0, 1000)}` : "",
    discussion.found ? `Public discussion of the interview process:\n${discussion.summary.slice(0, 1000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const raw = await callForCategory(llm, category, `Company's actual interview process:\n${context}`);
  // These questions are about the process as a whole, not one requirement, so they carry no requirement_ids.
  return raw.map((q) => ({
    id: nextId("q"),
    requirement_ids: [],
    category: q.category,
    prompt: q.prompt.trim(),
    answer_outline: q.answer_outline.trim(),
    difficulty: q.difficulty,
    origin: "generated" as const,
  }));
}
