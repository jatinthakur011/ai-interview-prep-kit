"use client";
import { useState } from "react";
import type { Kit } from "@/lib/types";

export default function CompanyBriefCard({ kit, onSave }: { kit: Kit; onSave: (patch: { summary?: string; what_they_do?: string }) => Promise<void> }) {
  const [summary, setSummary] = useState(kit.company_brief.summary);
  const [what, setWhat] = useState(kit.company_brief.what_they_do);

  async function commit() {
    const patch: { summary?: string; what_they_do?: string } = {};
    if (summary !== kit.company_brief.summary) patch.summary = summary;
    if (what !== kit.company_brief.what_they_do) patch.what_they_do = what;
    if (Object.keys(patch).length) await onSave(patch);
  }

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium text-ink">{kit.source.company || "Company brief"}</h2>
        <span className="text-xs text-ink/50">{kit.source.role}{kit.role.seniority ? ` · ${kit.role.seniority}` : ""}</span>
      </div>
      {!kit.company_brief.summary && !kit.company_brief.what_they_do && (
        <p className="mt-2 text-sm text-ink/50">
          We could not find enough public information about this company to write a brief.
        </p>
      )}
      <div className="field mt-3">
        <label className="field-label">What they do</label>
        <textarea value={what} onChange={(e) => setWhat(e.target.value)} onBlur={commit} rows={2} className="textarea" />
      </div>
      <div className="field mt-3">
        <label className="field-label">Summary</label>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} onBlur={commit} rows={3} className="textarea" />
      </div>
      {kit.company_brief.sources.length > 0 && (
        <p className="mt-3 text-xs text-ink/40">
          Sources: {kit.company_brief.sources.map((s) => new URL(s).hostname).join(", ")}
        </p>
      )}
    </div>
  );
}
