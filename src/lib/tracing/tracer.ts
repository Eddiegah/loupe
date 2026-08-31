import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { Exporter } from "./exporter";
import type { SpanType, TokenUsage } from "./types";

interface TraceContext {
  runId: string;
  currentSpanId: string | null;
}

export interface SpanHandle {
  setOutput(output: unknown): void;
  setTokenUsage(usage: TokenUsage): void;
}

export interface StartTraceResult<T> {
  result: T;
  runId: string;
}

/**
 * Tracks the "current" span via AsyncLocalStorage so nested spans attach to
 * whichever span is open in the calling async context, without callers
 * threading a parent id through every function signature by hand.
 */
export class Tracer {
  private als = new AsyncLocalStorage<TraceContext>();

  constructor(private exporter: Exporter) {}

  async startTrace<T>(task: string, fn: (tracer: Tracer) => Promise<T>): Promise<StartTraceResult<T>> {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();

    // Announce the run immediately so it shows up as "running" even if the
    // process crashes before completion.
    await this.exporter.flush({ id: runId, task, status: "running", startedAt });

    try {
      const result = await this.als.run({ runId, currentSpanId: null }, () => fn(this));
      await this.exporter.flush({ id: runId, task, status: "completed", startedAt, endedAt: new Date().toISOString() });
      return { result, runId };
    } catch (err) {
      await this.exporter.flush({ id: runId, task, status: "failed", startedAt, endedAt: new Date().toISOString() });
      throw err;
    }
  }

  async span<T>(opts: { type: SpanType; name: string; input?: unknown }, fn: (span: SpanHandle) => Promise<T>): Promise<T> {
    const ctx = this.als.getStore();
    if (!ctx) throw new Error("Tracer.span() called outside of startTrace()");

    const id = randomUUID();
    const parentSpanId = ctx.currentSpanId;
    const startedAtMs = Date.now();
    let output: unknown = null;
    let tokenUsage: TokenUsage | null = null;
    let error: string | null = null;

    const handle: SpanHandle = {
      setOutput(o) {
        output = o;
      },
      setTokenUsage(u) {
        tokenUsage = u;
      },
    };

    try {
      return await this.als.run({ ...ctx, currentSpanId: id }, () => fn(handle));
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const endedAtMs = Date.now();
      this.exporter.addSpan({
        id,
        runId: ctx.runId,
        parentSpanId,
        type: opts.type,
        name: opts.name,
        input: opts.input ?? null,
        output,
        startedAt: new Date(startedAtMs).toISOString(),
        endedAt: new Date(endedAtMs).toISOString(),
        durationMs: endedAtMs - startedAtMs,
        tokenUsage,
        error,
      });
    }
  }
}
