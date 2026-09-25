export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-ink/60" role="status" aria-live="polite">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-accent" />
      {label ?? "Loading…"}
    </div>
  );
}
