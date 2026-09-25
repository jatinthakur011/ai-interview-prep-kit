"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Kit, KitDocFull, Question, QuestionCategory } from "@/lib/types";
import { useRequireAuth } from "@/lib/useRequireAuth";
import Spinner from "@/components/Spinner";
import FormError from "@/components/FormError";
import StatusBadge from "@/components/StatusBadge";
import CoverageBanner from "@/components/CoverageBanner";
import RequirementsList from "@/components/RequirementsList";
import CompanyBriefCard from "@/components/CompanyBriefCard";
import QuestionEditor from "@/components/QuestionEditor";
import FlashcardEditor from "@/components/FlashcardEditor";
import ScheduleView from "@/components/ScheduleView";

const CATEGORIES: { key: QuestionCategory; label: string }[] = [
  { key: "technical", label: "Technical" },
  { key: "behavioural", label: "Behavioural" },
  { key: "system-design", label: "System design" },
  { key: "company-fit", label: "Company fit" },
];

export default function KitPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<KitDocFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [newQPrompt, setNewQPrompt] = useState("");
  const [newQCategory, setNewQCategory] = useState<QuestionCategory>("technical");
  const [newCardFront, setNewCardFront] = useState("");
  const [newCardBack, setNewCardBack] = useState("");

  const load = useCallback(async () => {
    try {
      setDoc(await api.getKit(params.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load this kit.");
    }
  }, [params.id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Poll while generating/regenerating so the person watches real progress rather than a static spinner.
  useEffect(() => {
    if (!doc || (doc.status !== "generating" && doc.status !== "pending")) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [doc, load]);

  async function withKitUpdate(fn: () => Promise<Kit>) {
    setError(null);
    try {
      const kit = await fn();
      setDoc((prev) => (prev ? { ...prev, kit } : prev));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That change could not be saved. Please try again.");
    }
  }

  async function onRegenerate(target: string) {
    if (!doc) return;
    setRegenerating(target);
    setError(null);
    try {
      await api.regenerate(doc.id, target);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start regeneration.");
    } finally {
      setRegenerating(null);
    }
  }

  async function onReorder(category: QuestionCategory, qid: string, direction: "up" | "down") {
    if (!doc?.kit) return;
    const all = doc.kit.questions;
    const inCategory = all.filter((q) => q.category === category);
    const idx = inCategory.findIndex((q) => q.id === qid);
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= inCategory.length) return;
    const reordered = [...inCategory];
    [reordered[idx], reordered[swapWith]] = [reordered[swapWith], reordered[idx]];
    const newOrder = all.map((q) => q.id).filter((id) => !inCategory.some((c) => c.id === id));
    // Re-splice the reordered category back into the full list, preserving other categories' positions.
    const fullOrder: string[] = [];
    let ci = 0;
    for (const q of all) {
      if (q.category === category) fullOrder.push(reordered[ci++].id);
      else fullOrder.push(q.id);
    }
    await withKitUpdate(() => api.reorderQuestions(doc.id, fullOrder));
  }

  if (authLoading || !user) return <Spinner label="Checking your session…" />;
  if (!doc && !error) return <Spinner label="Loading kit…" />;

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-ink/50 hover:text-accent hover:underline focus-ring rounded">
        ← My kits
      </Link>

      <div className="mt-3">
        <FormError message={error} />
      </div>

      {doc && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">{doc.company || "Prep kit"}</h1>
            <StatusBadge status={doc.status} />
          </div>

          {(doc.status === "pending" || doc.status === "generating") && (
            <div className="card card-pad sm:p-6 mt-6">
              <Spinner label="Researching the company and building your kit — this can take up to a couple of minutes…" />
              <p className="mt-3 text-sm text-ink/60">
                We're crawling the company site, looking for public discussion of their interview process, and
                writing questions category by category. Feel free to leave this page; your kit will be waiting on
                the dashboard.
              </p>
            </div>
          )}

          {doc.status === "failed" && (
            <div className="panel-danger mt-6 p-6">
              <p className="font-medium">Kit generation failed</p>
              <p className="mt-1 text-sm">{doc.error?.message ?? "Unknown error."}</p>
            </div>
          )}

          {doc.status === "ready" && doc.kit && (
            <div className="mt-6 flex flex-col gap-8">
              {doc.skippedSources.length > 0 && (
                <details className="panel-warning">
                  <summary className="cursor-pointer font-medium">
                    {doc.skippedSources.length} source{doc.skippedSources.length === 1 ? "" : "s"} could not be used
                  </summary>
                  <ul className="mt-2 list-inside list-disc space-y-0.5">
                    {doc.skippedSources.map((s, i) => (
                      <li key={i}>{s.url}: {s.reason}</li>
                    ))}
                  </ul>
                </details>
              )}

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="section-title">Company brief</h2>
                  <RegenButton busy={regenerating === "company_brief"} onClick={() => onRegenerate("company_brief")} />
                </div>
                <CompanyBriefCard kit={doc.kit} onSave={(patch) => withKitUpdate(() => api.editBrief(doc.id, patch))} />
              </section>

              <section>
                <h2 className="mb-2 section-title">Role requirements</h2>
                <RequirementsList requirements={doc.kit.role.requirements} />
              </section>

              <section>
                <h2 className="mb-2 section-title">Coverage</h2>
                <CoverageBanner kit={doc.kit} />
              </section>

              <section>
                <h2 className="mb-3 section-title">Question bank</h2>
                <div className="flex flex-col gap-6">
                  {CATEGORIES.map(({ key, label }) => {
                    const qs = doc.kit!.questions.filter((q) => q.category === key);
                    return (
                      <div key={key}>
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="font-medium text-ink">{label} <span className="font-normal text-ink/40">({qs.length})</span></h3>
                          <RegenButton busy={regenerating === key} onClick={() => onRegenerate(key)} />
                        </div>
                        {qs.length === 0 ? (
                          <p className="text-sm text-ink/40">No questions in this category yet.</p>
                        ) : (
                          <ul className="flex flex-col gap-2.5">
                            {qs.map((q, i) => (
                              <QuestionEditor
                                key={q.id}
                                question={q}
                                index={i}
                                count={qs.length}
                                onSave={(patch) => withKitUpdate(() => api.editQuestion(doc.id, q.id, patch))}
                                onMove={(category) => withKitUpdate(() => api.moveQuestion(doc.id, q.id, category))}
                                onDelete={() => withKitUpdate(() => api.deleteQuestion(doc.id, q.id))}
                                onReorder={(dir) => onReorder(key, q.id, dir)}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>

                <form
                  className="panel-dashed mt-4 flex flex-col gap-2.5 p-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newQPrompt.trim()) return;
                    await withKitUpdate(() =>
                      api.addQuestion(doc.id, { prompt: newQPrompt, category: newQCategory })
                    );
                    setNewQPrompt("");
                  }}
                >
                  <p className="field-label">Add a question by hand</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={newQPrompt}
                      onChange={(e) => setNewQPrompt(e.target.value)}
                      placeholder="Question prompt"
                      className="input-sm flex-1"
                    />
                    <select
                      value={newQCategory}
                      onChange={(e) => setNewQCategory(e.target.value as QuestionCategory)}
                      className="select-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                    <button type="submit" className="btn-primary btn-sm">
                      Add
                    </button>
                  </div>
                </form>
              </section>

              <section>
                <h2 className="mb-3 section-title">
                  Flashcards <span className="normal-case text-ink/40">({doc.kit.flashcards.length})</span>
                </h2>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {doc.kit.flashcards.map((c) => (
                    <FlashcardEditor
                      key={c.id}
                      card={c}
                      onSave={(patch) => withKitUpdate(() => api.editFlashcard(doc.id, c.id, patch))}
                      onDelete={() => withKitUpdate(() => api.deleteFlashcard(doc.id, c.id))}
                    />
                  ))}
                </ul>
                <form
                  className="panel-dashed mt-3 flex flex-col gap-2.5 p-4 sm:flex-row"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newCardFront.trim() || !newCardBack.trim()) return;
                    await withKitUpdate(() => api.addFlashcard(doc.id, { front: newCardFront, back: newCardBack }));
                    setNewCardFront("");
                    setNewCardBack("");
                  }}
                >
                  <input value={newCardFront} onChange={(e) => setNewCardFront(e.target.value)} placeholder="Front" className="input-sm flex-1" />
                  <input value={newCardBack} onChange={(e) => setNewCardBack(e.target.value)} placeholder="Back" className="input-sm flex-1" />
                  <button type="submit" className="btn-primary btn-sm">
                    Add card
                  </button>
                </form>
                <Link href={`/kits/${doc.id}/practice`} className="btn-primary btn-md mt-4 inline-flex">
                  Practice with flashcards →
                </Link>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="section-title">
                    Study schedule ({doc.kit.schedule.days_available} day{doc.kit.schedule.days_available === 1 ? "" : "s"})
                  </h2>
                  <RegenButton busy={regenerating === "schedule"} onClick={() => onRegenerate("schedule")} />
                </div>
                <ScheduleView kit={doc.kit} />
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RegenButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={busy} className="btn-secondary btn-sm">
      {busy ? "Regenerating…" : "Regenerate"}
    </button>
  );
}
