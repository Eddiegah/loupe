import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { getRun, getRunSpans, buildSpanTree } from "@/lib/queries/runs";
import type { SpanRecord } from "@/lib/tracing/types";
import { ingestTrace } from "../ingestTrace";

describe("ingestTrace: round-trip against real Postgres", () => {
  it("persists a run + span tree and reads it back with the right structure and server-recomputed totals", async () => {
    const runId = randomUUID();
    const rootId = randomUUID();
    const childId = randomUUID();
    const startedAt = new Date().toISOString();

    const rootSpan: SpanRecord = {
      id: rootId,
      runId,
      parentSpanId: null,
      type: "llm_call",
      name: "claude-sonnet-5",
      input: { messages: [] },
      output: { text: "hi" },
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: 120,
      tokenUsage: { inputTokens: 100, outputTokens: 20 },
      error: null,
    };
    const childSpan: SpanRecord = {
      id: childId,
      runId,
      parentSpanId: rootId,
      type: "tool_call",
      name: "search_docs",
      input: { query: "auth" },
      output: { results: [] },
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: 40,
      tokenUsage: null,
      error: null,
    };

    // First batch: announces the run as running, no spans yet - mirrors
    // Tracer.startTrace()'s initial flush().
    await ingestTrace({ run: { id: runId, task: `round-trip test ${runId}`, status: "running", startedAt }, spans: [] });
    // Second batch: the completed run plus its full span tree.
    await ingestTrace({
      run: { id: runId, task: `round-trip test ${runId}`, status: "completed", startedAt, endedAt: new Date().toISOString() },
      spans: [rootSpan, childSpan],
    });

    const run = await getRun(runId);
    expect(run?.status).toBe("completed");
    // 100 + 20 + 0 (child has no token usage) - server-recomputed from the
    // spans actually stored, not a client-sent figure.
    expect(run?.totalTokens).toBe(120);

    const flatSpans = await getRunSpans(runId);
    expect(flatSpans).toHaveLength(2);

    const tree = buildSpanTree(flatSpans);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(rootId);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe(childId);

    await db.delete(runs).where(eq(runs.id, runId));
  });
});
