const STYLES: Record<string, string> = {
  running: "bg-[var(--status-running)]/10 text-[var(--status-running)]",
  completed: "bg-[var(--status-success)]/10 text-[var(--status-success)]",
  failed: "bg-[var(--status-error)]/10 text-[var(--status-error)]",
};

export function RunStatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status] ?? ""}`}>{status}</span>;
}
