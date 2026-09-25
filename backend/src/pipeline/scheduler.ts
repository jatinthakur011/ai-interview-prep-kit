import type { Question, Requirement, ScheduleDay } from "../domain/kit.js";

const MINUTES_BY_DIFFICULTY: Record<number, number> = { 1: 10, 2: 15, 3: 20 };
const REVIEW_DAY_MINUTES = 30;

export interface Schedule {
  days_available: number;
  days: ScheduleDay[];
}

/** Higher = should be studied earlier. Must-have beats nice; harder beats easier. */
function priorityScore(q: Question, reqById: Map<string, Requirement>): number {
  const hasMust = q.requirement_ids.some((id) => reqById.get(id)?.priority === "must");
  return (hasMust ? 10 : 0) + q.difficulty;
}

/**
 * Pure allocation, no model involved.
 *  1. Sort questions by priorityScore desc (ties keep original order -> stable).
 *  2. Split into exactly `days` contiguous buckets, sizes as even as possible,
 *     earlier buckets get the remainder -> hardest / must-have material lands early.
 *  3. If there are fewer questions than days, the leftover days become review days
 *     that re-list the hardest earlier questions, so every day is non-empty and the
 *     schedule always spans exactly the days requested (1-day and 60-day both work).
 */
export function allocateSchedule(
  questions: Question[],
  requirements: Requirement[],
  daysRequested: number
): Schedule {
  const days = Math.max(1, Math.floor(daysRequested));
  const reqById = new Map(requirements.map((r) => [r.id, r]));

  const ordered = questions
    .map((q, i) => ({ q, i, score: priorityScore(q, reqById) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.q);

  const studyDays = Math.min(days, ordered.length);
  const result: ScheduleDay[] = [];

  if (studyDays > 0) {
    const base = Math.floor(ordered.length / studyDays);
    const extra = ordered.length % studyDays;
    let cursor = 0;
    for (let d = 0; d < studyDays; d++) {
      const size = base + (d < extra ? 1 : 0);
      const bucket = ordered.slice(cursor, cursor + size);
      cursor += size;
      result.push({
        day: d + 1,
        focus: focusFor(bucket, reqById),
        question_ids: bucket.map((q) => q.id),
        minutes: bucket.reduce((sum, q) => sum + (MINUTES_BY_DIFFICULTY[q.difficulty] ?? 15), 0),
      });
    }
  }

  // Review days: cycle through the hardest questions again.
  for (let d = studyDays; d < days; d++) {
    const pick = ordered.length ? [ordered[(d - studyDays) % ordered.length]] : [];
    result.push({
      day: d + 1,
      focus: ordered.length ? "Review and mock run-through" : "No questions yet: nothing to study",
      question_ids: pick.map((q) => q.id),
      minutes: REVIEW_DAY_MINUTES,
    });
  }

  return { days_available: days, days: result };
}

function focusFor(bucket: Question[], reqById: Map<string, Requirement>): string {
  const texts: string[] = [];
  for (const q of bucket)
    for (const id of q.requirement_ids) {
      const t = reqById.get(id)?.text;
      if (t && !texts.includes(t)) texts.push(t);
    }
  if (texts.length === 0) return bucket[0]?.category ?? "General practice";
  return texts.slice(0, 2).join("; ");
}
