import { describe, it, expect } from "vitest";
import { processCase } from "../src/cli/evaluate.js";
import { fakeLlm } from "./fakeLlm.js";
import { resetQuestionIdCounter } from "../src/pipeline/generateQuestions.js";
import { resetFlashcardIdCounter } from "../src/pipeline/generateFlashcards.js";

const extraction = JSON.stringify({
  company: "Acme",
  title: "Backend Engineer",
  seniority: "mid",
  location: "Remote",
  responsibilities: ["Build APIs"],
  requirements: [
    { text: "3+ years Node.js", kind: "technical", priority: "must", evidence: "3+ years of Node.js" },
  ],
});

const questionReply = JSON.stringify({
  questions: [{ prompt: "Explain the event loop.", answer_outline: "Mention the call stack and queues.", category: "technical", difficulty: 2 }],
});

describe("evaluate CLI: processCase", () => {
  it("returns status ok with a valid kit for a normal case", async () => {
    resetQuestionIdCounter();
    resetFlashcardIdCounter();
    const llm = fakeLlm([extraction, questionReply]);
    const result = await processCase(
      { id: "case-01", jd: "Backend Engineer. Must have 3+ years of Node.js experience.", company_url: "http://localhost:1/", days: 3 },
      llm,
      null
    );
    expect(result.status).toBe("ok");
    expect(result.error).toBeNull();
    expect((result.kit as any).source.company).toBe("Acme");
    expect((result.kit as any).schedule.days).toHaveLength(3);
  });

  it("returns status failed (not thrown) when the job description is empty", async () => {
    const llm = fakeLlm([extraction]);
    const result = await processCase({ id: "case-02", jd: "   ", company_url: "http://localhost:1/", days: 2 }, llm, null);
    expect(result.status).toBe("failed");
    expect(result.kit).toBeNull();
    expect(result.error?.code).toBe("EMPTY_JD");
  });

  it("returns status failed when the model never produces valid extraction JSON", async () => {
    const llm = fakeLlm(["not json", "still not json"]);
    const result = await processCase({ id: "case-03", jd: "Some job description text.", company_url: "http://localhost:1/", days: 2 }, llm, null);
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("BAD_MODEL_OUTPUT");
  });

  it("still returns ok when the company site is unreachable (honest, degraded kit, not a failure)", async () => {
    resetQuestionIdCounter();
    resetFlashcardIdCounter();
    const llm = fakeLlm([extraction, questionReply]);
    const result = await processCase(
      { id: "case-04", jd: "Backend Engineer. Must have 3+ years of Node.js experience.", company_url: "http://localhost:1/", days: 1 },
      llm,
      null
    );
    expect(result.status).toBe("ok");
    expect((result.kit as any).company_brief.sources).toEqual([]);
    expect((result.kit as any).source.pages_used).toEqual([]);
  });
});
