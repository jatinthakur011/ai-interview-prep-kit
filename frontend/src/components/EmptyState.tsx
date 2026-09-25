export default function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="panel-dashed px-6 py-14 text-center">
      <p className="font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
