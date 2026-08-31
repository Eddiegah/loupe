import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runs, spans } from "@/lib/db/schema";
import { estimateCostMicros } from "@/lib/tracing/pricing";
import type { RunEnvelope } from "@/lib/tracing/exporter";
import type { SpanRecord, TokenUsage } from "@/lib/tracing/types";

export interface IngestPayload {
  run: RunEnvelope;
  spans: SpanRecord[];
}

export async function ingestTrace(payload: IngestPayload): Promise<{ runId: string }> {
  const { run, spans: incomingSpans } = payload;

  // Upsert: the first batch for a run creates the row (status "running");
  // a later batch carrying endedAt/a terminal status updates it in place.
  await db
    .insert(runs)
    .values({
      id: run.id,
      task: run.task,
      label: run.label ?? null,
      status: run.status,
      startedAt: new Date(run.startedAt),
      endedAt: run.endedAt ? new Date(run.endedAt) : null,
    })
    .onConflictDoUpdate({
      target: runs.id,
      set: {
        status: run.status,
        endedAt: run.endedAt ? new Date(run.endedAt) : null,
      },
    });

  if (incomingSpans.length > 0) {
    await db.insert(spans).values(
      incomingSpans.map((s) => ({
        id: s.id,
        runId: s.runId,
        parentSpanId: s.parentSpanId,
        type: s.type,
        name: s.name,
        input: s.input,
        output: s.output,
        startedAt: new Date(s.startedAt),
        endedAt: new Date(s.endedAt),
        durationMs: s.durationMs,
        tokenUsage: s.tokenUsage,
        error: s.error,
      }))
    );
  }

  // Recompute totals server-side from every span stored for this run so
  // far, rather than trusting whatever total the client reports - a buggy
  // (or future non-SDK) caller shouldn't be able to report an arbitrary
  // token/cost figure for its own run.
  const allSpansForRun = await db.select().from(spans).where(eq(spans.runId, run.id));
  let totalTokens = 0;
  let totalCostMicros = 0;
  for (const s of allSpansForRun) {
    const usage = s.tokenUsage as TokenUsage | null;
    if (!usage) continue;
    totalTokens += usage.inputTokens + usage.outputTokens;
    totalCostMicros += estimateCostMicros(s.name, usage.inputTokens, usage.outputTokens);
  }

  await db.update(runs).set({ totalTokens, totalCostMicros }).where(eq(runs.id, run.id));

  return { runId: run.id };
}
