import type { SpanNode } from "@/lib/queries/runs";

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-background p-3 font-mono text-xs text-foreground">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export function SpanDetailPanel({ span }: { span: SpanNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-mono text-sm font-medium text-foreground">{span.name}</div>
          <div className="text-xs text-muted">
            {span.type} &middot; {span.durationMs ?? 0}ms
          </div>
        </div>
        {span.error && <span className="rounded-full bg-[var(--status-error)]/10 px-2 py-0.5 text-xs font-medium text-[var(--status-error)]">error</span>}
      </div>
      {span.error && <p className="mb-3 text-sm text-[var(--status-error)]">{span.error}</p>}
      {span.tokenUsage != null && <JsonBlock label="Token usage" value={span.tokenUsage} />}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <JsonBlock label="Input" value={span.input} />
        <JsonBlock label="Output" value={span.output} />
      </div>
    </div>
  );
}
