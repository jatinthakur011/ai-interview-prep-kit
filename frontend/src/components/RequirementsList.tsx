import type { Requirement } from "@/lib/types";

export default function RequirementsList({ requirements }: { requirements: Requirement[] }) {
  if (requirements.length === 0)
    return <p className="text-sm text-ink/60">No specific requirements could be found in this job description.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {requirements.map((r) => (
        <li
          key={r.id}
          className={`rounded-full border px-3 py-1 text-xs ${
            r.priority === "must" ? "border-accent/25 bg-accent-soft text-accent" : "border-black/15 bg-black/[0.03] text-ink/70"
          }`}
        >
          {r.text} <span className="text-ink/35">· {r.priority}</span>
        </li>
      ))}
    </ul>
  );
}
