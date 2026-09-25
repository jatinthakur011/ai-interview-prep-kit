import { describe, it, expect, beforeEach } from "vitest";
import { generateQuestionsForRequirement, generateProcessQuestions, resetQuestionIdCounter } from "../src/pipeline/generateQuestions.js";
import { fakeLlm } from "./fakeLlm.js";
import type { Requirement } from "../src/domain/kit.js";

beforeEach(() => resetQuestionIdCounter());

const technicalReq: Requirement = { id: "r1", text: "5+ years with React", kind: "technical", priority: "must" };
const behaviouralReq: Requirement = { id: "r2", text: "Mentor junior engineers", kind: "behavioural", priority: "must" };

const techReply = JSON.stringify({
  questions: [{ prompt: "Explain React reconciliation.", answer_outline: "Fiber, diffing, keys.", category: "technical", difficulty: 3 }],
});
const behaviouralReply = JSON.stringify({
  questions: [{ prompt: "Tell me about mentoring someone.", answer_outline: "Situation, action, outcome.", category: "behavioural", difficulty: 2 }],
});

describe("generateQuestionsForRequirement", () => {
  it("tags every question with the requirement id and assigns unique ids", async () => {
    const qs = await generateQuestionsForRequirement(technicalReq, "React role", fakeLlm([techReply]));
    expect(qs).toHaveLength(1);
    expect(qs[0].requirement_ids).toEqual(["r1"]);
    expect(qs[0].id).toBe("q1");
  });

  it("uses a different category/prompt for a behavioural requirement", async () => {
    const llm = fakeLlm([behaviouralReply]);
    const qs = await generateQuestionsForRequirement(behaviouralReq, "Mentoring role", llm);
    expect(qs[0].category).toBe("behavioural");
    expect(llm.calls[0].system).toMatch(/behavioural/i);
    expect(llm.calls[0].system).not.toMatch(/hands-on technical/i);
  });

  it("returns no questions (not a throw) after two invalid replies", async () => {
    const qs = await generateQuestionsForRequirement(technicalReq, "ctx", fakeLlm(["garbage", "still garbage"]));
    expect(qs).toEqual([]);
  });

  it("ids stay unique across multiple calls", async () => {
    const llm = fakeLlm([techReply]);
    const a = await generateQuestionsForRequirement(technicalReq, "ctx", llm);
    const b = await generateQuestionsForRequirement(technicalReq, "ctx", llm);
    expect(a[0].id).not.toBe(b[0].id);
  });
});

describe("generateProcessQuestions", () => {
  it("returns nothing when there is no hiring-process info at all", async () => {
    const qs = await generateProcessQuestions([technicalReq], null, { found: false, summary: "", sources: [] }, fakeLlm([techReply]));
    expect(qs).toEqual([]);
  });

  it("generates process questions with no requirement_ids when hiring info exists", async () => {
    const reply = JSON.stringify({ questions: [{ prompt: "Walk through the take-home.", answer_outline: "...", category: "system-design", difficulty: 2 }] });
    const qs = await generateProcessQuestions([technicalReq], "Take-home then system design.", { found: false, summary: "", sources: [] }, fakeLlm([reply]));
    expect(qs).toHaveLength(1);
    expect(qs[0].requirement_ids).toEqual([]);
  });
});
