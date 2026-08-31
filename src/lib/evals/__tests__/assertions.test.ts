import { describe, expect, it } from "vitest";
import { checkAssertions } from "../assertions";

const spans = [
  { type: "tool_call" as const, name: "search_docs" },
  { type: "llm_call" as const, name: "claude-sonnet-5" },
];

describe("checkAssertions", () => {
  it("must_call_tool passes when the tool was called and fails when it wasn't", () => {
    expect(checkAssertions([{ kind: "must_call_tool", tool: "search_docs" }], { spans, finalOutput: "", durationMs: 0 }).passed).toBe(true);
    expect(checkAssertions([{ kind: "must_call_tool", tool: "calculate" }], { spans, finalOutput: "", durationMs: 0 }).passed).toBe(false);
  });

  it("must_not_call_tool passes only when the tool was NOT called", () => {
    expect(checkAssertions([{ kind: "must_not_call_tool", tool: "calculate" }], { spans, finalOutput: "", durationMs: 0 }).passed).toBe(true);
    expect(checkAssertions([{ kind: "must_not_call_tool", tool: "search_docs" }], { spans, finalOutput: "", durationMs: 0 }).passed).toBe(false);
  });

  it("output_contains is case-insensitive", () => {
    expect(checkAssertions([{ kind: "output_contains", text: "HMAC" }], { spans, finalOutput: "use hmac-sha256", durationMs: 0 }).passed).toBe(true);
    expect(checkAssertions([{ kind: "output_contains", text: "RSA" }], { spans, finalOutput: "use hmac-sha256", durationMs: 0 }).passed).toBe(false);
  });

  it("max_latency_ms is inclusive at the boundary", () => {
    expect(checkAssertions([{ kind: "max_latency_ms", ms: 100 }], { spans, finalOutput: "", durationMs: 100 }).passed).toBe(true);
    expect(checkAssertions([{ kind: "max_latency_ms", ms: 100 }], { spans, finalOutput: "", durationMs: 101 }).passed).toBe(false);
  });

  it("AND-combines multiple assertions", () => {
    const result = checkAssertions(
      [
        { kind: "must_call_tool", tool: "search_docs" },
        { kind: "output_contains", text: "nope" },
      ],
      { spans, finalOutput: "yes", durationMs: 0 }
    );
    expect(result.passed).toBe(false);
    expect(result.results).toHaveLength(2);
  });
});
