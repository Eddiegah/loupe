import type { SpanRecord } from "@/lib/tracing/types";

export type Assertion =
  | { kind: "must_call_tool"; tool: string }
  | { kind: "must_not_call_tool"; tool: string }
  | { kind: "output_contains"; text: string }
  | { kind: "max_latency_ms"; ms: number };

export interface AssertionContext {
  spans: Pick<SpanRecord, "type" | "name">[];
  finalOutput: string;
  durationMs: number;
}

export interface AssertionResult {
  passed: boolean;
  detail: string;
}

function checkOne(assertion: Assertion, ctx: AssertionContext): AssertionResult {
  switch (assertion.kind) {
    case "must_call_tool": {
      const called = ctx.spans.some((s) => s.type === "tool_call" && s.name === assertion.tool);
      return { passed: called, detail: called ? `called ${assertion.tool}` : `expected a call to ${assertion.tool}, but it was never called` };
    }
    case "must_not_call_tool": {
      const called = ctx.spans.some((s) => s.type === "tool_call" && s.name === assertion.tool);
      return { passed: !called, detail: called ? `${assertion.tool} was called but should not have been` : `${assertion.tool} correctly not called` };
    }
    case "output_contains": {
      const contains = ctx.finalOutput.toLowerCase().includes(assertion.text.toLowerCase());
      return { passed: contains, detail: contains ? `output contains "${assertion.text}"` : `output does not contain "${assertion.text}"` };
    }
    case "max_latency_ms": {
      const withinBudget = ctx.durationMs <= assertion.ms;
      return { passed: withinBudget, detail: `took ${ctx.durationMs}ms, budget ${assertion.ms}ms` };
    }
  }
}

export function checkAssertions(assertions: Assertion[], ctx: AssertionContext): { passed: boolean; results: AssertionResult[] } {
  const results = assertions.map((a) => checkOne(a, ctx));
  return { passed: results.every((r) => r.passed), results };
}
