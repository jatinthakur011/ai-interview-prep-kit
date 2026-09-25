import { describe, it, expect } from "vitest";
import { findUncoveredRequirements, uncoveredMustHaves } from "../src/pipeline/coverage.js";
import { questions, requirements } from "./fixtures.js";

describe("coverage", () => {
  it("reports nothing when all requirements are covered", () => {
    expect(findUncoveredRequirements(requirements, questions)).toEqual([]);
  });

  it("reports requirements no question references, must-haves first", () => {
    const qs = questions.filter((q) => q.id === "q3");
    const gaps = findUncoveredRequirements(requirements, qs).map((r) => r.id);
    expect(gaps).toEqual(["r1", "r2"]);
  });

  it("ignores question ids pointing at unknown requirements", () => {
    const qs = [{ ...questions[0], requirement_ids: ["r999"] }];
    expect(findUncoveredRequirements(requirements, qs)).toHaveLength(3);
  });

  it("uncoveredMustHaves excludes nice-to-haves", () => {
    const gaps = uncoveredMustHaves(requirements, []);
    expect(gaps.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});
