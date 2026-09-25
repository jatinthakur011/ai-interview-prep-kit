"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/useRequireAuth";
import Spinner from "@/components/Spinner";
import FormError from "@/components/FormError";

type BatchCase = { jd: string; company_url: string; days: number };

/** Accepts a JSON array of {jd, company_url, days} — the same shape the batch CLI reads (Appendix B, minus id). */
function parseBatchFile(text: string): BatchCase[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('File must contain a JSON array of {jd, company_url, days} objects.');
  return data.map((c: any, i: number) => {
    if (!c.jd || !c.company_url) throw new Error(`Entry ${i + 1} is missing "jd" or "company_url".`);
    return { jd: String(c.jd), company_url: String(c.company_url), days: Number(c.days) || 5 };
  });
}

export default function NewKitPage() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [batchCases, setBatchCases] = useState<BatchCase[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const cases = parseBatchFile(await file.text());
      setBatchCases(cases);
    } catch (err) {
      setBatchCases(null);
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  async function onSubmitSingle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { id } = await api.createKit(jd, companyUrl, days);
      router.push(`/kits/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  async function onSubmitBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!batchCases?.length) return setError("Choose a file first.");
    setError(null);
    setBusy(true);
    try {
      await api.createKitsBatch(batchCases);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (loading || !user) return <Spinner label="Checking your session…" />;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight text-ink">New prep kit</h1>
      <p className="mt-1 text-sm text-ink/55">Generate one kit, or upload a file to create several at once.</p>

      <div className="mt-5 flex gap-2" role="tablist" aria-label="Kit creation mode">
        <button
          role="tab"
          aria-selected={mode === "single"}
          onClick={() => setMode("single")}
          className={mode === "single" ? "tab-active" : "tab-inactive"}
        >
          One role
        </button>
        <button
          role="tab"
          aria-selected={mode === "batch"}
          onClick={() => setMode("batch")}
          className={mode === "batch" ? "tab-active" : "tab-inactive"}
        >
          Multiple roles (file upload)
        </button>
      </div>

      <div className="mt-4">
        <FormError message={error} />
      </div>

      {mode === "single" ? (
        <form onSubmit={onSubmitSingle} className="card card-pad sm:p-6 mt-4 flex flex-col gap-4">
          <div className="field">
            <label className="field-label">Job description</label>
            <textarea
              required
              rows={10}
              placeholder="Paste the full job description here…"
              className="textarea"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">Company website</label>
            <input
              type="url"
              required
              placeholder="https://acme.com"
              className="input"
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">Days until the interview</label>
            <input
              type="number"
              min={1}
              max={60}
              required
              className="input w-32"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </div>
          <button type="submit" disabled={busy} className="btn-primary-gradient btn-md mt-1 self-start mt-1 self-start">
            {busy ? "Starting…" : "Generate kit"}
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmitBatch} className="card card-pad sm:p-6 mt-4 flex flex-col gap-4">
          <p className="text-sm text-ink/70">
            Upload a JSON file: an array of <code className="rounded bg-black/[0.05] px-1.5 py-0.5 text-xs">{"{ jd, company_url, days }"}</code> objects,
            one per role.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onFileChange}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/20"
          />
          {batchCases && (
            <p className="text-sm text-success">{batchCases.length} role(s) found in the file.</p>
          )}
          <button type="submit" disabled={busy || !batchCases?.length} className="btn-primary-gradient btn-md mt-1 self-start mt-1 self-start">
            {busy ? "Starting…" : "Generate all kits"}
          </button>
        </form>
      )}
    </div>
  );
}
