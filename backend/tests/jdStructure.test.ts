import { describe, it, expect } from "vitest";
import { evidenceInJd, priorityHintFor } from "../src/pipeline/jdStructure.js";

const JD = `Senior Engineer

Requirements:
- 5+ years with React
- Strong Node.js skills

Nice to have:
- GraphQL experience
- Kubernetes

About the team:
Bonus points for open source contributions. Docker is required.`;

describe("jdStructure", () => {
  it("finds evidence regardless of case and punctuation", () => {
    expect(evidenceInJd(JD, "5+ YEARS with react")).toBe(true);
    expect(evidenceInJd(JD, "Rust expertise")).toBe(false);
  });

  it("reads section headings", () => {
    expect(priorityHintFor(JD, "5+ years with React")).toBe("must");
    expect(priorityHintFor(JD, "GraphQL experience")).toBe("nice");
    expect(priorityHintFor(JD, "Kubernetes")).toBe("nice");
  });

  it("line-level wording beats surrounding context", () => {
    expect(priorityHintFor(JD, "Bonus points for open source contributions")).toBe("nice");
    expect(priorityHintFor(JD, "Docker is required")).toBe("must");
  });

  it("returns null when the JD does not settle it", () => {
    expect(priorityHintFor("We use Python daily.", "We use Python daily")).toBeNull();
  });
});
