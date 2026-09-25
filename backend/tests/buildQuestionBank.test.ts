import { describe, it, expect, beforeEach } from "vitest";
import { buildQuestionBank } from "../src/pipeline/buildQuestionBank.js";
import { resetQuestionIdCounter } from "../src/pipeline/generateQuestions.js";
import { fakeLlm } from "./fakeLlm.js";
import type { Requirement } from "../src/domain/kit.js";

beforeEach(() => resetQuestionIdCounter());

const requirements: Requirement[] = [
  { id: "r1", text: "5+ years with React", kind: "technical", priority: "must" },
  { id: "r2", text: "Mentor junior engineers", kind: "behavioural", priority: "must" },
  { id: "r3", text: "GraphQL", kind: "technical", priority: "nice" },
];

const noDiscussion = { found: false, summary: "", sources: [] };
const reply = (category: string, prompt: string) =>
  JSON.stringify({ questions: [{ prompt, answer_outline: "outline", category, difficulty: 2 }] });

describe("buildQuestionBank", () => {
  it("covers every requirement in one pass when the model succeeds first try", async () => {
    const llm = fakeLlm([
      reply("technical", "React Q"),
      reply("behavioural", "Mentor Q"),
      reply("technical", "GraphQL Q"),
    ]);
    const r = await buildQuestionBank(requirements, "jd text", null, noDiscussion, llm);
    expect(r.uncoveredRequirementIds).toEqual([]);
    expect(r.passes).toBe(1);
  });

  it("runs a second pass to fill a gap left by the first (out-of-order calls handled)", async () => {
    let mentorCalls = 0;
    const llm = {
      calls: [] as any[],
      async generateJson(req: any) {
        this.calls.push(req);
        // r1 and r3 succeed first try. r2 (behavioural) fails its whole first pass
        // (both the initial attempt and the in-call repair attempt return garbage),
        // then succeeds on the second buildQuestionBank pass.
        if (/Mentor junior engineers/.test(req.user)) {
          mentorCalls++;
          return mentorCalls <= 2 ? "garbage" : reply("behavioural", "Mentor Q (pass 2)");
        }
        if (/React/.test(req.user)) return reply("technical", "React Q");
        return reply("technical", "GraphQL Q");
      },
    };
    const r = await buildQuestionBank(requirements, "jd text", null, noDiscussion, llm as any);
    expect(r.passes).toBe(2);
    expect(r.uncoveredRequirementIds).toEqual([]);
    expect(r.questions.some((q) => q.prompt.includes("pass 2"))).toBe(true);
  });

  it("records honest gaps instead of looping forever when the model keeps failing", async () => {
    const llm = fakeLlm(["garbage"]); // every call returns garbage
    const r = await buildQuestionBank(requirements, "jd text", null, noDiscussion, llm);
    expect(r.passes).toBe(3);
    expect(r.uncoveredRequirementIds.sort()).toEqual(["r1", "r2", "r3"]);
  });

  it("does not abort the whole kit when one requirement's call throws", async () => {
    let n = 0;
    const llm = {
      calls: [] as any[],
      async generateJson(req: any) {
        this.calls.push(req);
        n++;
        if (/React/.test(req.user)) throw new Error("boom");
        return reply(/Mentor/.test(req.user) ? "behavioural" : "technical", "Q");
      },
    };
    const r = await buildQuestionBank(requirements, "jd text", null, noDiscussion, llm as any);
    expect(r.uncoveredRequirementIds).toContain("r1");
    expect(r.questions.some((q) => q.requirement_ids.includes("r2"))).toBe(true);
  });

  it("adds process questions with no requirement_ids without affecting coverage", async () => {
    const llm = fakeLlm([
      reply("technical", "React Q"),
      reply("behavioural", "Mentor Q"),
      reply("technical", "GraphQL Q"),
      reply("system-design", "Process Q"),
    ]);
    const r = await buildQuestionBank(requirements, "jd", "Take-home then onsite.", noDiscussion, llm);
    expect(r.questions.some((q) => q.category === "system-design" && q.requirement_ids.length === 0)).toBe(true);
    expect(r.uncoveredRequirementIds).toEqual([]);
  });
});
