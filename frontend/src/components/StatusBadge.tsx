import type { KitStatus } from "@/lib/types";

const STYLES: Record<KitStatus, string> = {
  pending: "bg-warning-soft text-warning",
  generating: "bg-info-soft text-info",
  ready: "bg-success-soft text-success",
  failed: "bg-danger-soft text-danger",
};
const LABELS: Record<KitStatus, string> = {
  pending: "Pending",
  generating: "Generating…",
  ready: "Ready",
  failed: "Failed",
};

export default function StatusBadge({ status }: { status: KitStatus }) {
  return <span className={`badge ${STYLES[status]}`}>{LABELS[status]}</span>;
}
