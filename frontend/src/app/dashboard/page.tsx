"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { KitDocSummary } from "@/lib/types";
import { useRequireAuth } from "@/lib/useRequireAuth";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import FormError from "@/components/FormError";

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const [kits, setKits] = useState<KitDocSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function load() {
    try {
      setKits(await api.listKits());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load your kits.");
    }
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  // Poll while any kit is still generating, so the dashboard reflects progress without a manual refresh.
  useEffect(() => {
    if (!kits?.some((k) => k.status === "generating" || k.status === "pending")) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [kits]);

  async function onDelete(id: string) {
    if (!confirm("Delete this kit? This cannot be undone.")) return;
    await api.deleteKit(id);
    setKits((prev) => prev?.filter((k) => k.id !== id) ?? null);
  }

  if (loading || !user) return <Spinner label="Checking your session…" />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">My kits</h1>
          <p className="mt-0.5 text-sm text-ink/55">Every prep kit you've generated, in one place.</p>
        </div>
        <Link href="/kits/new" className="btn-primary btn-md">
          + New kit
        </Link>
      </div>

      <div className="mt-6">
        <FormError message={error} />
        {kits === null && !error && <Spinner label="Loading your kits…" />}
        {kits?.length === 0 && (
          <EmptyState
            title="No kits yet"
            hint="Paste a job description to generate your first prep kit."
            action={
              <Link href="/kits/new" className="btn-primary-gradient btn-md">
                Create a kit
              </Link>
            }
          />
        )}
        <ul className="flex flex-col gap-2.5">
          {kits?.map((k) => (
            <li key={k.id} className="card card-hover flex items-center justify-between px-4 py-3.5">
              <button
                className="flex-1 text-left focus-ring rounded"
                onClick={() => router.push(`/kits/${k.id}`)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{k.company || "Untitled company"}</span>
                  <StatusBadge status={k.status} />
                </div>
                <p className="text-sm text-ink/60">{k.role} · {k.days} day{k.days === 1 ? "" : "s"}</p>
                {k.status === "failed" && k.error && <p className="mt-1 text-xs text-danger">{k.error.message}</p>}
              </button>
              <button
                onClick={() => onDelete(k.id)}
                aria-label={`Delete kit for ${k.company || "this role"}`}
                className="ml-3 rounded-md px-2 py-1 text-sm text-ink/50 hover:bg-danger-soft hover:text-danger focus-ring"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
