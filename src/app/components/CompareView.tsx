import type { Run } from "@/lib/db/schema";
import type { SpanNode } from "@/lib/queries/runs";

interface FlatRow {
  span: SpanNode;
  depth: number;
}

function flatten(nodes: SpanNode[], depth = 0): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const node of nodes) {
    rows.push({ span: node, depth });
    rows.push(...flatten(node.children, depth + 1));
  }
  return rows;
}

function RunColumn({ run, tree }: { run: Run; tree: SpanNode[] }) {
  const rows = flatten(tree);
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <div className="truncate text-sm font-medium text-foreground">{run.task}</div>
        <div className="text-xs text-muted">
          {run.totalTokens.toLocaleString()} tokens &middot; {rows.length} spans
        </div>
      </div>
      <ol className="divide-y divide-border">
        {rows.map(({ span, depth }, i) => (
          <li key={span.id} className="flex items-center gap-2 px-4 py-2 text-xs">
            <span className="w-5 shrink-0 text-muted">{i + 1}</span>
            <span className="truncate font-mono text-foreground" style={{ paddingLeft: `${depth * 12}px` }}>
              {span.error ? "⚠ " : ""}
              {span.name}
            </span>
            <span className="ml-auto shrink-0 text-muted">{span.durationMs ?? 0}ms</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Two run's span lists side by side, aligned by index rather than a true
 * LCS diff - a deliberate v1 simplification (see README), good enough
 * since two runs of the same eval task are usually close to isomorphic in
 * step count. */
export function CompareView({ runA, runB }: { runA: { run: Run; tree: SpanNode[] }; runB: { run: Run; tree: SpanNode[] } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <RunColumn run={runA.run} tree={runA.tree} />
      <RunColumn run={runB.run} tree={runB.tree} />
    </div>
  );
}
