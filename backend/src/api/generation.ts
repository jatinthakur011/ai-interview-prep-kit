import type { ObjectId } from "mongodb";
import { kitsCollection, type KitDocument } from "../db/collections.js";
import { generateKit, KitGenerationError } from "../pipeline/generateKit.js";
import { regenerateSection, type RegenerateTarget } from "../pipeline/regenerateSection.js";
import { createLLMFromEnv } from "../llm/gemini.js";
import { createDiscussionClientFromEnv } from "../discussion/braveSearch.js";

/**
 * Generation is slow, external and failure-prone (brief Section 13): it can
 * take ~90 seconds, fail halfway, or be triggered twice for the same
 * posting. So POST /api/kits returns immediately with a "pending" document
 * and this function runs in the background; the frontend polls
 * GET /api/kits/:id for status. A kit is moved to "generating" synchronously
 * before this starts, which also blocks a duplicate submit for the same
 * document (Section 10: "the same description and company are submitted
 * twice") from racing it.
 */
export async function runGeneration(kitId: ObjectId): Promise<void> {
  const kits = kitsCollection();
  const doc = await kits.findOne({ _id: kitId });
  if (!doc) return;

  try {
    const llm = createLLMFromEnv();
    const discussion = createDiscussionClientFromEnv();
    const { kit, skippedSources } = await generateKit({
      jd: doc.input.jd,
      companyUrl: doc.input.companyUrl,
      days: doc.input.days,
      llm,
      discussion,
    });
    await kits.updateOne(
      { _id: kitId },
      { $set: { status: "ready", kit, skippedSources, error: null, updatedAt: new Date() } }
    );
  } catch (e) {
    // Always log the full error server-side (including any wrapped cause), since only a
    // short message/code is persisted to the kit document for the frontend to show.
    console.error(`[generateKit] kit ${kitId.toString()} failed:`, e);
    if (e instanceof KitGenerationError && e.cause) console.error("  caused by:", e.cause);
    const error =
      e instanceof KitGenerationError
        ? { code: e.code, message: e.message }
        : { code: "UNKNOWN_ERROR", message: (e as Error)?.message ?? "Generation failed." };
    await kits.updateOne({ _id: kitId }, { $set: { status: "failed", error, updatedAt: new Date() } });
  }
}

export async function runRegeneration(kitId: ObjectId, target: RegenerateTarget, daysOverride?: number): Promise<void> {
  const kits = kitsCollection();
  const doc = (await kits.findOne({ _id: kitId })) as KitDocument | null;
  if (!doc || !doc.kit) return;

  try {
    const llm = createLLMFromEnv();
    const discussion = createDiscussionClientFromEnv();
    const updated = await regenerateSection(doc.kit, { target, jd: doc.input.jd, llm, discussion, daysOverride });
    await kits.updateOne({ _id: kitId }, { $set: { status: "ready", kit: updated, error: null, updatedAt: new Date() } });
  } catch (e) {
    console.error(`[regenerateSection] kit ${kitId.toString()} (${target}) failed:`, e);
    if (e instanceof KitGenerationError && e.cause) console.error("  caused by:", e.cause);
    const error =
      e instanceof KitGenerationError
        ? { code: e.code, message: e.message }
        : { code: "UNKNOWN_ERROR", message: (e as Error)?.message ?? "Regeneration failed." };
    // The previous ready kit is left in place; only the error is recorded, so a
    // failed regeneration never destroys the last good version the user had.
    await kits.updateOne({ _id: kitId }, { $set: { status: "ready", error, updatedAt: new Date() } });
  }
}
