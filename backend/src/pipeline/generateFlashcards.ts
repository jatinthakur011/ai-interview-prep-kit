import type { Flashcard, Question, Requirement } from "../domain/kit.js";

let counter = 0;
const nextId = () => `f${++counter}`;
export const resetFlashcardIdCounter = () => {
  counter = 0;
};

/**
 * Flashcards are derived deterministically from the already-generated
 * questions/requirements rather than with a fresh LLM call. Two reasons,
 * both from the brief itself: (1) Section "Preferred Tech Stack" warns that
 * free-tier token-per-minute limits are the most common way to lose points,
 * and a kit already makes one call per requirement plus a process-question
 * call — adding a flashcard call per requirement would roughly double that
 * budget for no new information. (2) the content already exists: a
 * requirement's best (lowest-difficulty, most concrete) question and its
 * answer_outline *is* a flashcard. One flashcard per requirement that has at
 * least one question, front = requirement text, back = that question's
 * answer outline (or the requirement text itself if outlines are empty).
 */
export function generateFlashcards(requirements: Requirement[], questions: Question[]): Flashcard[] {
  const byRequirement = new Map<string, Question[]>();
  for (const q of questions) {
    for (const rid of q.requirement_ids) {
      byRequirement.set(rid, [...(byRequirement.get(rid) ?? []), q]);
    }
  }

  const cards: Flashcard[] = [];
  for (const req of requirements) {
    const qs = byRequirement.get(req.id) ?? [];
    if (qs.length === 0) continue; // no covering question yet: nothing honest to put on the back
    // Prefer a concrete answer outline; among candidates, the easiest question
    // tends to be the most fundamental one worth memorising first.
    const best = [...qs].sort((a, b) => a.difficulty - b.difficulty)[0];
    const back = best.answer_outline.trim() || `Be ready to speak to: ${req.text}`;
    cards.push({
      id: nextId(),
      front: req.text,
      back,
      requirement_ids: [req.id],
      origin: "generated",
    });
  }
  return cards;
}
