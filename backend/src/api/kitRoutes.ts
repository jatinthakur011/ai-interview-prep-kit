import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { kitsCollection, toId, isValidId, type KitDocument } from "../db/collections.js";
import { requireAuth } from "../auth/session.js";
import { badRequest, notFound } from "./errors.js";
import { runGeneration, runRegeneration } from "./generation.js";
import { validateKit } from "../domain/validateKit.js";
import { QuestionSchema, type Question, type Flashcard, type Kit } from "../domain/kit.js";

export const kitRouter = Router();
kitRouter.use(requireAuth);

const newId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

const CreateKitSchema = z.object({
  jd: z.string().min(1, "Job description is required."),
  company_url: z.string().min(1, "Company website is required."),
  days: z.number().int().min(1).max(60),
});
const BatchCreateSchema = z.array(CreateKitSchema).min(1).max(20);

function summarize(doc: KitDocument) {
  return {
    id: doc._id.toString(),
    status: doc.status,
    error: doc.error,
    company: doc.kit?.source.company || null,
    role: doc.kit?.source.role || doc.input.jd.slice(0, 60),
    days: doc.input.days,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Loads a kit the current user owns, or responds 404 (Section 1: users can read/modify only their own kits). */
async function loadOwnedKit(userId: string, id: string): Promise<KitDocument | null> {
  if (!isValidId(id)) return null;
  return kitsCollection().findOne({ _id: toId(id), userId: toId(userId) });
}

kitRouter.post("/", async (req, res) => {
  const parsed = CreateKitSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid input.");

  const now = new Date();
  const doc: Omit<KitDocument, "_id"> = {
    userId: toId(req.user!.userId),
    status: "pending",
    error: null,
    input: { jd: parsed.data.jd, companyUrl: parsed.data.company_url, days: parsed.data.days },
    kit: null,
    practice: {},
    skippedSources: [],
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await kitsCollection().insertOne(doc as any);
  await kitsCollection().updateOne({ _id: insertedId }, { $set: { status: "generating" } });
  void runGeneration(insertedId); // fire-and-forget; client polls GET /:id for progress

  res.status(202).json({ id: insertedId.toString(), status: "generating" });
});

/** Prepare for more than one role at once (brief Section 2). */
kitRouter.post("/batch", async (req, res) => {
  const parsed = BatchCreateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid input.");

  const now = new Date();
  const docs: Omit<KitDocument, "_id">[] = parsed.data.map((c) => ({
    userId: toId(req.user!.userId),
    status: "generating" as const,
    error: null,
    input: { jd: c.jd, companyUrl: c.company_url, days: c.days },
    kit: null,
    practice: {},
    skippedSources: [],
    createdAt: now,
    updatedAt: now,
  }));
  const { insertedIds } = await kitsCollection().insertMany(docs as any);
  const ids = Object.values(insertedIds) as ObjectId[];

  // Small concurrency cap so a big batch doesn't blow through the LLM
  // provider's tokens-per-minute limit all at once (brief's biggest warning).
  const CONCURRENCY = 2;
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= ids.length) return;
      await runGeneration(ids[i]);
    }
  };
  void Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));

  res.status(202).json({ ids: ids.map((i) => i.toString()) });
});

kitRouter.get("/", async (req, res) => {
  const docs = await kitsCollection()
    .find({ userId: toId(req.user!.userId) })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(docs.map(summarize));
});

kitRouter.get("/:id", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc) return notFound(res, "Kit");
  res.json({
    id: doc._id.toString(),
    status: doc.status,
    error: doc.error,
    input: doc.input,
    kit: doc.kit,
    practice: doc.practice,
    skippedSources: doc.skippedSources,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
});

kitRouter.delete("/:id", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc) return notFound(res, "Kit");
  await kitsCollection().deleteOne({ _id: doc._id });
  res.status(204).end();
});

const RegenerateSchema = z.object({
  target: z.enum(["company_brief", "schedule", "technical", "behavioural", "system-design", "company-fit"]),
  days: z.number().int().min(1).max(60).optional(),
});

/** Regenerate one section without discarding edits made elsewhere (brief Section 6). */
kitRouter.post("/:id/regenerate", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc) return notFound(res, "Kit");
  if (doc.status !== "ready") return badRequest(res, `Kit is ${doc.status}; wait for it to finish first.`);
  const parsed = RegenerateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid target.");

  await kitsCollection().updateOne({ _id: doc._id }, { $set: { status: "generating", updatedAt: new Date() } });
  void runRegeneration(doc._id, parsed.data.target, parsed.data.days);

  res.status(202).json({ id: doc._id.toString(), status: "generating" });
});

// ---------------------------------------------------------------------------
// Builder: inline edits that must survive a later regeneration of the
// section they don't belong to (brief Section 6). Each handler loads the
// kit, mutates a plain-object copy, re-validates with validateKit (backend
// requirement: "validate a generated kit against the expected structure
// before saving it"), and only then persists.
// ---------------------------------------------------------------------------

async function saveEditedKit(res: import("express").Response, doc: KitDocument, nextKit: unknown) {
  const result = validateKit(nextKit);
  if (!result.ok) return badRequest(res, `Edit would leave the kit invalid: ${result.errors.join("; ")}`);
  await kitsCollection().updateOne({ _id: doc._id }, { $set: { kit: result.kit, updatedAt: new Date() } });
  res.json(result.kit);
}

const QuestionEditSchema = z.object({
  prompt: z.string().min(1).optional(),
  answer_outline: z.string().optional(),
  category: QuestionSchema.shape.category.optional(),
  difficulty: QuestionSchema.shape.difficulty.optional(),
  requirement_ids: z.array(z.string()).optional(),
});
const QuestionCreateSchema = z.object({
  prompt: z.string().min(1),
  answer_outline: z.string().default(""),
  category: QuestionSchema.shape.category,
  difficulty: QuestionSchema.shape.difficulty.default(2),
  requirement_ids: z.array(z.string()).default([]),
});

kitRouter.post("/:id/questions", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc || !doc.kit) return notFound(res, "Kit");
  const parsed = QuestionCreateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid question.");

  const question: Question = { id: newId("q"), origin: "user_added", ...parsed.data };
  const nextKit = { ...doc.kit, questions: [...doc.kit.questions, question] };
  await saveEditedKit(res, doc, nextKit);
});

kitRouter.patch("/:id/questions/:qid", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc || !doc.kit) return notFound(res, "Kit");
  const parsed = QuestionEditSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid edit.");
  if (!doc.kit.questions.some((q) => q.id === req.params.qid)) return notFound(res, "Question");

  const questions = doc.kit.questions.map((q): Question =>
    q.id === req.params.qid
      ? { ...q, ...parsed.data, origin: q.origin === "user_added" ? "user_added" : "user_edited" }
      : q
  );
  await saveEditedKit(res, doc, { ...doc.kit, questions });
});

/** Move a question from one category to another (brief Section 6) — a category edit. */
kitRouter.patch("/:id/questions/:qid/move", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc || !doc.kit) return notFound(res, "Kit");
  const parsed = z.object({ category: QuestionSchema.shape.category }).safeParse(req.body);
  if (!parsed.success) return badRequest(res, "A valid target category is required.");
  if (!doc.kit.questions.some((q) => q.id === req.params.qid)) return notFound(res, "Question");

  const questions = doc.kit.questions.map((q): Question =>
    q.id === req.params.qid
      ? { ...q, category: parsed.data.category, origin: q.origin === "user_added" ? "user_added" : "user_edited" }
      : q
  );
  await saveEditedKit(res, doc, { ...doc.kit, questions });
});

kitRouter.delete("/:id/questions/:qid", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc || !doc.kit) return notFound(res, "Kit");
  const questions = doc.kit.questions.filter((q) => q.id !== req.params.qid);
  const schedule = pruneSchedule(doc.kit.schedule, questions);
  await saveEditedKit(res, doc, { ...doc.kit, questions, schedule });
});

/** Reorder questions within their list; category boundaries are implicit in the order. */
kitRouter.patch("/:id/questions", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc || !doc.kit) return notFound(res, "Kit");
  const parsed = z.object({ order: z.array(z.string()).min(1) }).safeParse(req.body);
  if (!parsed.success) return badRequest(res, "A full list of question ids in the new order is required.");

  const byId = new Map(doc.kit.questions.map((q) => [q.id, q]));
  if (parsed.data.order.length !== byId.size || parsed.data.order.some((id) => !byId.has(id)))
    return badRequest(res, "The order must include every existing question id exactly once.");

  const questions = parsed.data.order.map((id) => byId.get(id)!);
  await saveEditedKit(res, doc, { ...doc.kit, questions });
});

const FlashcardCreateSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()).default([]),
});
const FlashcardEditSchema = z.object({
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  requirement_ids: z.array(z.string()).optional(),
});

kitRouter.post("/:id/flashcards", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc || !doc.kit) return notFound(res, "Kit");
  const parsed = FlashcardCreateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid flashcard.");

  const card: Flashcard = { id: newId("f"), origin: "user_added", ...parsed.data };
  await saveEditedKit(res, doc, { ...doc.kit, flashcards: [...doc.kit.flashcards, card] });
});

kitRouter.patch("/:id/flashcards/:fid", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc || !doc.kit) return notFound(res, "Kit");
  const parsed = FlashcardEditSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid edit.");
  if (!doc.kit.flashcards.some((f) => f.id === req.params.fid)) return notFound(res, "Flashcard");

  const flashcards = doc.kit.flashcards.map((f): Flashcard =>
    f.id === req.params.fid
      ? { ...f, ...parsed.data, origin: f.origin === "user_added" ? "user_added" : "user_edited" }
      : f
  );
  await saveEditedKit(res, doc, { ...doc.kit, flashcards });
});

kitRouter.delete("/:id/flashcards/:fid", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc || !doc.kit) return notFound(res, "Kit");
  const flashcards = doc.kit.flashcards.filter((f) => f.id !== req.params.fid);
  const practice = { ...doc.practice };
  delete practice[req.params.fid];
  const result = validateKit({ ...doc.kit, flashcards });
  if (!result.ok) return badRequest(res, `Edit would leave the kit invalid: ${result.errors.join("; ")}`);
  await kitsCollection().updateOne({ _id: doc._id }, { $set: { kit: result.kit, practice, updatedAt: new Date() } });
  res.json(result.kit);
});

const BriefEditSchema = z.object({ summary: z.string().min(1).optional(), what_they_do: z.string().min(1).optional() });

kitRouter.patch("/:id/company-brief", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc || !doc.kit) return notFound(res, "Kit");
  const parsed = BriefEditSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "Invalid edit.");
  await saveEditedKit(res, doc, { ...doc.kit, company_brief: { ...doc.kit.company_brief, ...parsed.data } });
});

const ScheduleEditSchema = z.object({
  days: z.array(
    z.object({
      day: z.number().int().min(1),
      focus: z.string().min(1),
      question_ids: z.array(z.string()),
      minutes: z.number().int().min(0),
    })
  ),
});

/** Direct edit of the day-by-day plan (e.g. after manually reordering study days). */
kitRouter.patch("/:id/schedule", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc || !doc.kit) return notFound(res, "Kit");
  const parsed = ScheduleEditSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid schedule.");
  await saveEditedKit(res, doc, {
    ...doc.kit,
    schedule: { days_available: parsed.data.days.length, days: parsed.data.days },
  });
});

const MINUTES_BY_DIFFICULTY: Record<number, number> = { 1: 10, 2: 15, 3: 20 };

/** Drops a deleted question's id from every schedule day and recomputes that day's minutes. */
function pruneSchedule(schedule: Kit["schedule"], remaining: Question[]): Kit["schedule"] {
  const byId = new Map(remaining.map((q) => [q.id, q]));
  return {
    ...schedule,
    days: schedule.days.map((d) => {
      const question_ids = d.question_ids.filter((id) => byId.has(id));
      const minutes = question_ids.reduce((sum, id) => sum + (MINUTES_BY_DIFFICULTY[byId.get(id)!.difficulty] ?? 15), 0);
      return { ...d, question_ids, minutes };
    }),
  };
}

// ---------------------------------------------------------------------------
// Practice mode (brief Section 7)
// ---------------------------------------------------------------------------

const PracticeSchema = z.object({ confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]) });

kitRouter.post("/:id/practice/:flashcardId", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc || !doc.kit) return notFound(res, "Kit");
  if (!doc.kit.flashcards.some((f) => f.id === req.params.flashcardId)) return notFound(res, "Flashcard");
  const parsed = PracticeSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "confidence must be 1, 2 or 3.");

  const prev = doc.practice[req.params.flashcardId];
  const record = { confidence: parsed.data.confidence, reviews: (prev?.reviews ?? 0) + 1, lastReviewedAt: new Date().toISOString() };
  await kitsCollection().updateOne(
    { _id: doc._id },
    { $set: { [`practice.${req.params.flashcardId}`]: record, updatedAt: new Date() } }
  );
  res.json(record);
});

/**
 * Practice-session order: never-reviewed cards first (nothing is known
 * about them yet, so treat them as the least confident), then reviewed
 * cards from least to most confident, each group oldest-reviewed first.
 * Simple confidence-weighted sort, as the brief allows ("a simple
 * confidence-weighted sort is fine").
 */
kitRouter.get("/:id/practice/next", async (req, res) => {
  const doc = await loadOwnedKit(req.user!.userId, req.params.id);
  if (!doc || !doc.kit) return notFound(res, "Kit");

  const scored = doc.kit.flashcards.map((card) => {
    const record = doc.practice[card.id];
    return { card, confidence: record?.confidence ?? 0, lastReviewedAt: record?.lastReviewedAt ?? "" };
  });
  scored.sort((a, b) => a.confidence - b.confidence || a.lastReviewedAt.localeCompare(b.lastReviewedAt));

  res.json({
    order: scored.map((s) => s.card.id),
    covered: scored.filter((s) => s.confidence > 0).length,
    total: scored.length,
  });
});
