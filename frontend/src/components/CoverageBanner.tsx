import type { Kit } from "@/lib/types";

export default function CoverageBanner({ kit }: { kit: Kit }) {
  const gaps = kit.coverage.uncovered_requirement_ids
    .map((id) => kit.role.requirements.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r);
  if (gaps.length === 0) {
    return (
      <p className="panel-success">
        Every requirement extracted from the posting has at least one question ({kit.coverage.passes} pass
        {kit.coverage.passes === 1 ? "" : "es"}).
      </p>
    );
  }
  return (
    <div className="panel-warning">
      <p className="font-medium">{gaps.length} requirement{gaps.length === 1 ? "" : "s"} still without a question:</p>
      <ul className="mt-1.5 list-inside list-disc space-y-0.5">
        {gaps.map((r) => (
          <li key={r.id}>{r.text}</li>
        ))}
      </ul>
    </div>
  );
}
