import type { Kit } from "@/lib/types";

export default function ScheduleView({ kit }: { kit: Kit }) {
  const byId = new Map(kit.questions.map((q) => [q.id, q]));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {kit.schedule.days.map((d) => (
        <div key={d.day} className="card card-pad">
          <div className="flex items-baseline justify-between">
            <h3 className="font-medium text-ink">Day {d.day}</h3>
            <span className="badge bg-black/[0.04] text-ink/60">{d.minutes} min</span>
          </div>
          <p className="mt-1 text-sm text-ink/70">{d.focus}</p>
          {d.question_ids.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-ink/60">
              {d.question_ids.map((id) => (
                <li key={id} className="truncate">{byId.get(id)?.prompt ?? id}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink/40">Nothing scheduled.</p>
          )}
        </div>
      ))}
    </div>
  );
}
