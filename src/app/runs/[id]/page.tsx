import { notFound } from "next/navigation";
import Link from "next/link";
import { getRun, getRunSpans, buildSpanTree } from "@/lib/queries/runs";
import { RunStatusBadge } from "@/app/components/RunStatusBadge";
import { TokenCostBadge } from "@/app/components/TokenCostBadge";
import { SpanWaterfall } from "@/app/components/SpanWaterfall";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();

  const spans = await getRunSpans(id);
  const tree = buildSpanTree(spans);
  // Only a completed/failed run has a fixed duration - a still-running
  // run's elapsed time would change on every render, which isn't
  // something a server component can compute purely. For the waterfall's
  // proportional bars, fall back to the latest span's end time instead of
  // the current wall clock.
  const durationMs = run.endedAt ? run.endedAt.getTime() - run.startedAt.getTime() : null;
  const latestSpanEnd = spans.reduce((max, s) => Math.max(max, new Date(s.endedAt ?? s.startedAt).getTime()), run.startedAt.getTime());
  const waterfallDurationMs = Math.max(durationMs ?? latestSpanEnd - run.startedAt.getTime(), 1);

  return (
    <div>
      <Link href="/runs" className="text-sm text-muted hover:text-foreground">
        &larr; All runs
      </Link>
      <div className="mt-2 mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{run.task}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted">
            <RunStatusBadge status={run.status} />
            <TokenCostBadge tokens={run.totalTokens} costMicros={run.totalCostMicros} />
            <span>{durationMs !== null ? `${durationMs}ms total` : "in progress"}</span>
          </div>
        </div>
        <Link href={`/runs/compare?a=${id}`} className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:border-accent">
          Compare&hellip;
        </Link>
      </div>

      {spans.length === 0 ? (
        <p className="text-sm text-muted">No spans recorded for this run yet.</p>
      ) : (
        <SpanWaterfall tree={tree} runStartedAt={run.startedAt.toISOString()} runDurationMs={waterfallDurationMs} />
      )}
    </div>
  );
}
