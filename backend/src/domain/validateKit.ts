import { KitSchema, type Kit } from "./kit.js";

export type ValidationResult =
  | { ok: true; kit: Kit }
  | { ok: false; errors: string[] };

/**
 * Structural validation (zod) plus the cross-reference rules from the brief
 * that a schema alone cannot express:
 *  - ids are unique within their collection
 *  - question/flashcard requirement_ids point at real requirements
 *  - schedule question_ids point at real questions
 *  - schedule has exactly days_available days, numbered 1..N
 */
export function validateKit(input: unknown): ValidationResult {
  const parsed = KitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const kit = parsed.data;
  const errors: string[] = [];

  const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
  const groups: Array<[string, string[]]> = [
    ["requirement", kit.role.requirements.map((r) => r.id)],
    ["question", kit.questions.map((q) => q.id)],
    ["flashcard", kit.flashcards.map((f) => f.id)],
  ];
  for (const [label, ids] of groups) {
    for (const d of new Set(dupes(ids))) errors.push(`duplicate ${label} id: ${d}`);
  }

  const reqIds = new Set(kit.role.requirements.map((r) => r.id));
  const qIds = new Set(kit.questions.map((q) => q.id));

  for (const q of kit.questions)
    for (const rid of q.requirement_ids)
      if (!reqIds.has(rid)) errors.push(`question ${q.id} references unknown requirement ${rid}`);
  for (const f of kit.flashcards)
    for (const rid of f.requirement_ids)
      if (!reqIds.has(rid)) errors.push(`flashcard ${f.id} references unknown requirement ${rid}`);

  for (const d of kit.schedule.days)
    for (const qid of d.question_ids)
      if (!qIds.has(qid)) errors.push(`schedule day ${d.day} references unknown question ${qid}`);

  if (kit.schedule.days.length !== kit.schedule.days_available)
    errors.push(
      `schedule has ${kit.schedule.days.length} days but days_available is ${kit.schedule.days_available}`
    );
  kit.schedule.days.forEach((d, i) => {
    if (d.day !== i + 1) errors.push(`schedule day at index ${i} is numbered ${d.day}, expected ${i + 1}`);
  });

  return errors.length ? { ok: false, errors } : { ok: true, kit };
}
