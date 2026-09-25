import type { Origin } from "@/lib/types";

const LABELS: Record<Origin, string> = { generated: "AI-generated", user_edited: "Edited by you", user_added: "Added by you" };
const COLORS: Record<Origin, string> = { generated: "bg-black/25", user_edited: "bg-amber-500", user_added: "bg-emerald-500" };

/** Small dot showing whether a question/flashcard is machine-written or touched by the user (brief Section 6). */
export default function OriginDot({ origin }: { origin?: Origin }) {
  const o = origin ?? "generated";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink/50" title={LABELS[o]}>
      <span className={`h-1.5 w-1.5 rounded-full ${COLORS[o]}`} />
      {LABELS[o]}
    </span>
  );
}
