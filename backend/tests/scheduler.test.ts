import { describe, it, expect } from "vitest";
import { allocateSchedule } from "../src/pipeline/scheduler.js";
import { questions, requirements } from "./fixtures.js";

describe("allocateSchedule", () => {
  it("spans exactly the requested days", () => {
    for (const d of [1, 2, 3, 5, 60]) {
      const s = allocateSchedule(questions, requirements, d);
      expect(s.days).toHaveLength(d);
      expect(s.days_available).toBe(d);
      expect(s.days.map((x) => x.day)).toEqual(Array.from({ length: d }, (_, i) => i + 1));
    }
  });

  it("allocates every question at least once", () => {
    const s = allocateSchedule(questions, requirements, 2);
    const scheduled = new Set(s.days.flatMap((d) => d.question_ids));
    for (const q of questions) expect(scheduled.has(q.id)).toBe(true);
  });

  it("puts must-have and harder material earlier", () => {
    const s = allocateSchedule(questions, requirements, 3);
    expect(s.days[0].question_ids).toEqual(["q1"]);
    expect(s.days[2].question_ids).toEqual(["q3"]);
  });

  it("uses integer minutes and non-empty days", () => {
    const s = allocateSchedule(questions, requirements, 10);
    for (const d of s.days) {
      expect(Number.isInteger(d.minutes)).toBe(true);
      expect(d.question_ids.length).toBeGreaterThan(0);
    }
  });

  it("handles a 1-day schedule by putting everything on day 1", () => {
    const s = allocateSchedule(questions, requirements, 1);
    expect(s.days[0].question_ids.sort()).toEqual(["q1", "q2", "q3"]);
  });

  it("handles zero questions without crashing", () => {
    const s = allocateSchedule([], requirements, 3);
    expect(s.days).toHaveLength(3);
  });
});
