"use client";

import { useState } from "react";
import type { SpanNode } from "@/lib/queries/runs";
import { SpanDetailPanel } from "./SpanDetailPanel";

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

export function SpanWaterfall({ tree, runStartedAt, runDurationMs }: { tree: SpanNode[]; runStartedAt: string; runDurationMs: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = flatten(tree);
  const runStart = new Date(runStartedAt).getTime();
  const total = Math.max(runDurationMs, 1);
  const selected = rows.find((r) => r.span.id === selectedId)?.span ?? null;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {rows.map(({ span, depth }) => {
          const startedAt = new Date(span.startedAt).getTime();
          const leftPct = Math.min(100, Math.max(0, ((startedAt - runStart) / total) * 100));
          const widthPct = Math.min(100 - leftPct, Math.max(0.5, ((span.durationMs ?? 0) / total) * 100));
          const barColor = span.error ? "var(--status-error)" : span.type === "llm_call" ? "var(--span-llm)" : "var(--span-tool)";

          return (
            <button
              key={span.id}
              type="button"
              onClick={() => setSelectedId(span.id)}
              className={`flex w-full items-center gap-3 border-b border-border px-4 py-2 text-left text-sm last:border-0 hover:bg-background ${
                selectedId === span.id ? "bg-background" : ""
              }`}
            >
              <span className="w-56 shrink-0 truncate font-mono text-xs text-foreground" style={{ paddingLeft: `${depth * 16}px` }}>
                {span.error ? "⚠ " : ""}
                {span.name}
              </span>
              <span className="relative h-4 flex-1 rounded bg-background">
                <span className="absolute top-0 h-4 rounded" style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: barColor }} />
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-xs text-muted">{span.durationMs ?? 0}ms</span>
            </button>
          );
        })}
      </div>
      {selected && <SpanDetailPanel span={selected} />}
    </div>
  );
}
