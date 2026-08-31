import { describe, expect, it, vi } from "vitest";
import { createExporter } from "../exporter";
import type { SpanRecord } from "../types";

function makeSpan(i: number, tokens: number): SpanRecord {
  return {
    id: `span-${i}`,
    runId: "run-1",
    parentSpanId: null,
    type: "tool_call",
    name: `span-${i}`,
    input: null,
    output: null,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    durationMs: 1,
    tokenUsage: { inputTokens: tokens, outputTokens: 0 },
    error: null,
  };
}

describe("createExporter: batching", () => {
  it("does not send anything before flush() establishes a run, even if spans are added", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    const exporter = createExporter({ batchSize: 3, fetchImpl });

    exporter.addSpan(makeSpan(1, 10));
    exporter.addSpan(makeSpan(2, 10));
    await Promise.resolve();

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("auto-flushes once the batch size is reached, and the final flush sends the remainder", async () => {
    const sentBatches: SpanRecord[][] = [];
    const fetchImpl: typeof fetch = vi.fn(async (_input, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      sentBatches.push(body.spans);
      return new Response(null, { status: 201 });
    });
    const exporter = createExporter({ batchSize: 3, fetchImpl });
    const run = { id: "run-1", task: "t", status: "running" as const, startedAt: new Date().toISOString() };

    // Establishes the run with an initial (empty) flush, matching how
    // Tracer.startTrace() announces a run before any spans exist.
    await exporter.flush(run);

    for (let i = 1; i <= 7; i++) exporter.addSpan(makeSpan(i, 10));
    await exporter.flush({ ...run, status: "completed", endedAt: new Date().toISOString() });

    const allSentSpans = sentBatches.flat();
    expect(allSentSpans).toHaveLength(7);
    const totalTokens = allSentSpans.reduce((sum, s) => sum + (s.tokenUsage?.inputTokens ?? 0), 0);
    expect(totalTokens).toBe(70);
    // batch-size boundary: at least one intermediate batch flushed at
    // exactly the configured size, not before and not accumulating past it
    expect(sentBatches.some((b) => b.length === 3)).toBe(true);
    expect(sentBatches.every((b) => b.length <= 3)).toBe(true);
  });
});
