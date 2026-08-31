import { describe, expect, it } from "vitest";
import { buildSpanTree } from "../runs";
import type { SpanRow } from "@/lib/db/schema";

function makeSpanRow(overrides: Partial<SpanRow> & Pick<SpanRow, "id">): SpanRow {
  return {
    runId: "run-1",
    parentSpanId: null,
    type: "tool_call",
    name: "span",
    input: null,
    output: null,
    startedAt: new Date(),
    endedAt: null,
    durationMs: null,
    tokenUsage: null,
    error: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("buildSpanTree", () => {
  it("nests children under their parent and keeps unparented spans as roots", () => {
    const flat: SpanRow[] = [
      makeSpanRow({ id: "a", parentSpanId: null, startedAt: new Date(0) }),
      makeSpanRow({ id: "b", parentSpanId: "a", startedAt: new Date(1) }),
      makeSpanRow({ id: "c", parentSpanId: "a", startedAt: new Date(2) }),
      makeSpanRow({ id: "d", parentSpanId: "b", startedAt: new Date(3) }),
    ];

    const tree = buildSpanTree(flat);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("a");
    expect(tree[0].children.map((c) => c.id)).toEqual(["b", "c"]);
    expect(tree[0].children[0].children.map((c) => c.id)).toEqual(["d"]);
  });

  it("treats a span whose parent isn't in the list as its own root, rather than dropping it", () => {
    const flat: SpanRow[] = [makeSpanRow({ id: "orphan", parentSpanId: "missing-parent" })];

    const tree = buildSpanTree(flat);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("orphan");
  });
});
