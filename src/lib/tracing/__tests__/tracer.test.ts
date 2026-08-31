import { describe, expect, it } from "vitest";
import { Tracer } from "../tracer";
import type { Exporter, RunEnvelope } from "../exporter";
import type { SpanRecord } from "../types";

function createFakeExporter() {
  const spans: SpanRecord[] = [];
  const flushes: RunEnvelope[] = [];
  const exporter: Exporter = {
    addSpan(span) {
      spans.push(span);
    },
    async flush(run) {
      flushes.push(run);
    },
  };
  return { exporter, spans, flushes };
}

describe("Tracer: nested span parenting", () => {
  it("assigns the enclosing span as parent for a nested span", async () => {
    const { exporter, spans } = createFakeExporter();
    const tracer = new Tracer(exporter);

    await tracer.startTrace("test task", async (t) => {
      await t.span({ type: "tool_call", name: "outer" }, async () => {
        await t.span({ type: "tool_call", name: "inner" }, async () => "done");
      });
    });

    const outer = spans.find((s) => s.name === "outer")!;
    const inner = spans.find((s) => s.name === "inner")!;
    expect(inner.parentSpanId).toBe(outer.id);
    expect(outer.parentSpanId).toBeNull();
    expect(outer.endedAt).toBeTruthy();
    expect(outer.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("gives sequential sibling spans the same parent, not each other", async () => {
    const { exporter, spans } = createFakeExporter();
    const tracer = new Tracer(exporter);

    await tracer.startTrace("test task", async (t) => {
      await t.span({ type: "tool_call", name: "parent" }, async () => {
        await t.span({ type: "tool_call", name: "sibling-a" }, async () => "a");
        await t.span({ type: "tool_call", name: "sibling-b" }, async () => "b");
      });
    });

    const parent = spans.find((s) => s.name === "parent")!;
    const a = spans.find((s) => s.name === "sibling-a")!;
    const b = spans.find((s) => s.name === "sibling-b")!;
    expect(a.parentSpanId).toBe(parent.id);
    expect(b.parentSpanId).toBe(parent.id);
    expect(a.id).not.toBe(b.id);
  });
});

describe("Tracer: error propagation", () => {
  it("closes the span and records the error, then rethrows", async () => {
    const { exporter, spans } = createFakeExporter();
    const tracer = new Tracer(exporter);

    await expect(
      tracer.startTrace("failing task", async (t) => {
        await t.span({ type: "tool_call", name: "boom" }, async () => {
          throw new Error("kaboom");
        });
      })
    ).rejects.toThrow("kaboom");

    const boom = spans.find((s) => s.name === "boom")!;
    expect(boom.error).toBe("kaboom");
    expect(boom.endedAt).toBeTruthy();
  });

  it("marks the run status failed when the traced function throws, but announces it running first", async () => {
    const { exporter, flushes } = createFakeExporter();
    const tracer = new Tracer(exporter);

    await expect(
      tracer.startTrace("failing task", async () => {
        throw new Error("top-level failure");
      })
    ).rejects.toThrow("top-level failure");

    expect(flushes[0].status).toBe("running");
    expect(flushes[flushes.length - 1].status).toBe("failed");
  });
});
