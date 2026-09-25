"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Flashcard, KitDocFull } from "@/lib/types";
import { useRequireAuth } from "@/lib/useRequireAuth";
import Spinner from "@/components/Spinner";
import FormError from "@/components/FormError";
import EmptyState from "@/components/EmptyState";

const CONFIDENCE_LABELS: Record<1 | 2 | 3, string> = { 1: "Still shaky", 2: "Getting there", 3: "Confident" };

export default function PracticePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const [doc, setDoc] = useState<KitDocFull | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [covered, setCovered] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [d, next] = await Promise.all([api.getKit(params.id), api.nextPracticeOrder(params.id)]);
        setDoc(d);
        setOrder(next.order);
        setCovered(next.covered);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not load practice mode.");
      }
    })();
  }, [user, params.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setRevealed((r) => !r); }
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, c - 1));
      if (revealed && ["1", "2", "3"].includes(e.key)) rate(Number(e.key) as 1 | 2 | 3);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, revealed, order]);

  const cardsById = new Map<string, Flashcard>(doc?.kit?.flashcards.map((c) => [c.id, c]) ?? []);
  const currentId = order[cursor];
  const current = currentId ? cardsById.get(currentId) : undefined;

  function next() {
    setRevealed(false);
    setCursor((c) => Math.min(order.length - 1, c + 1));
  }

  async function rate(confidence: 1 | 2 | 3) {
    if (!current || busy) return;
    setBusy(true);
    try {
      await api.recordPractice(params.id, current.id, confidence);
      setCovered((c) => c + (revealed ? 0 : 1)); // first time this card is answered this session
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your answer.");
    } finally {
      setBusy(false);
      next();
    }
  }

  if (authLoading || !user) return <Spinner label="Checking your session…" />;

  return (
    <div className="mx-auto max-w-xl">
      <Link href={`/kits/${params.id}`} className="text-sm text-ink/50 hover:text-accent hover:underline focus-ring rounded">
        ← Back to kit
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">Practice</h1>
      <div className="mt-3">
        <FormError message={error} />
      </div>

      {!doc && !error && <Spinner label="Loading flashcards…" />}

      {doc?.kit && order.length === 0 && (
        <EmptyState title="No flashcards yet" hint="Add some flashcards from the kit page first." />
      )}

      {doc?.kit && order.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink/55">
              Card {cursor + 1} of {order.length} · {covered} reviewed at least once
            </p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${((cursor + 1) / order.length) * 100}%` }}
            />
          </div>

          <div className="card mx-auto mt-4 flex min-h-[220px] flex-col justify-center p-6 text-center sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">{revealed ? "Answer" : "Question"}</p>
            <p className="mt-3 whitespace-pre-wrap text-lg text-ink">{revealed ? current?.back : current?.front}</p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => setRevealed((r) => !r)} className="btn-secondary btn-md">
              {revealed ? "Hide answer" : "Reveal answer"} <span className="text-ink/30">(space)</span>
            </button>

            {revealed && (
              <div className="flex gap-2">
                {([1, 2, 3] as const).map((n) => (
                  <button key={n} disabled={busy} onClick={() => rate(n)} className="btn-secondary btn-md">
                    {CONFIDENCE_LABELS[n]} <span className="text-ink/30">({n})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-between text-sm">
            <button
              onClick={() => { setRevealed(false); setCursor((c) => Math.max(0, c - 1)); }}
              disabled={cursor === 0}
              className="rounded text-ink/50 hover:text-accent hover:underline disabled:opacity-30 focus-ring"
            >
              ← Previous
            </button>
            <button
              onClick={next}
              disabled={cursor === order.length - 1}
              className="rounded text-ink/50 hover:text-accent hover:underline disabled:opacity-30 focus-ring"
            >
              Skip →
            </button>
          </div>
          <p className="mt-6 text-xs text-ink/40">
            Cards are ordered by confidence: never-reviewed and lowest-confidence cards come first, so the next
            session focuses on your weak spots.
          </p>
        </div>
      )}
    </div>
  );
}
