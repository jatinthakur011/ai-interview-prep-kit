import { describe, it, expect } from "vitest";
import { validateKit } from "../src/domain/validateKit.js";
import { allocateSchedule } from "../src/pipeline/scheduler.js";
import { questions, requirements } from "./fixtures.js";

const makeKit = () => structuredClone({
  source: { company: "Acme", company_url: "http://x/", role: "Dev", location: "", jd_chars: 10, researched_at: "2026-09-21T00:00:00Z", pages_used: [] },
  company_brief: { summary: "", what_they_do: "", sources: [] },
  role: { title: "Dev", seniority: "senior", responsibilities: [], requirements },
  questions,
  flashcards: [{ id: "f1", front: "a", back: "b", requirement_ids: ["r1"], origin: "generated" }],
  schedule: allocateSchedule(questions, requirements, 3),
  coverage: { uncovered_requirement_ids: [], passes: 1 },
});

describe("validateKit", () => {
  it("accepts a well-formed kit", () => {
    expect(validateKit(makeKit()).ok).toBe(true);
  });

  it("rejects wrong shape", () => {
    const r = validateKit({ nope: true });
    expect(r.ok).toBe(false);
  });

  it("rejects float minutes and bad difficulty", () => {
    const k: any = makeKit();
    k.schedule.days[0].minutes = 12.5;
    k.questions[0].difficulty = 5;
    const r = validateKit(k);
    expect(r.ok).toBe(false);
  });

  it("rejects schedule referencing a missing question", () => {
    const k: any = makeKit();
    k.schedule.days[0].question_ids = ["q404"];
    const r = validateKit(k);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/q404/);
  });

  it("rejects day count mismatch", () => {
    const k: any = makeKit();
    k.schedule.days_available = 5;
    expect(validateKit(k).ok).toBe(false);
  });

  it("rejects question referencing unknown requirement", () => {
    const k: any = makeKit();
    k.questions[0].requirement_ids = ["r404"];
    expect(validateKit(k).ok).toBe(false);
  });
});
