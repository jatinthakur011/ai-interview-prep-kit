import type { Question, Requirement } from "../domain/kit.js";

/**
 * Deterministic coverage check. A requirement is covered iff at least one
 * question lists its id in requirement_ids. The model never decides this.
 * Must-haves are returned first so callers can prioritise them.
 */
export function findUncoveredRequirements(
  requirements: Requirement[],
  questions: Question[]
): Requirement[] {
  const covered = new Set(questions.flatMap((q) => q.requirement_ids));
  const uncovered = requirements.filter((r) => !covered.has(r.id));
  return [
    ...uncovered.filter((r) => r.priority === "must"),
    ...uncovered.filter((r) => r.priority === "nice"),
  ];
}

export const uncoveredMustHaves = (reqs: Requirement[], qs: Question[]) =>
  findUncoveredRequirements(reqs, qs).filter((r) => r.priority === "must");
