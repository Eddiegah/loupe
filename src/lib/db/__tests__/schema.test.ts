import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../index";
import { runs, spans, evalTasks, evalResults } from "../schema";

describe("schema: cascade and survival behavior", () => {
  it("cascade-deletes spans and evalResults when their run is deleted, but leaves evalTasks intact", async () => {
    const runId = randomUUID();
    const spanId = randomUUID();
    const taskId = randomUUID();
    const now = new Date();

    await db.insert(runs).values({ id: runId, task: `schema test ${runId}`, status: "completed", startedAt: now });
    await db.insert(spans).values({
      id: spanId,
      runId,
      parentSpanId: null,
      type: "llm_call",
      name: "claude-sonnet-5",
      startedAt: now,
      tokenUsage: { inputTokens: 1, outputTokens: 1 },
    });
    await db.insert(evalTasks).values({ id: taskId, name: `schema test task ${taskId}`, prompt: "p", rubric: "r" });
    await db.insert(evalResults).values({
      id: randomUUID(),
      evalTaskId: taskId,
      runId,
      hardAssertionsPassed: true,
      judgeScore: 5,
      judgeRationale: "great",
    });

    await db.delete(runs).where(eq(runs.id, runId));

    const remainingSpans = await db.select().from(spans).where(eq(spans.runId, runId));
    const remainingResults = await db.select().from(evalResults).where(eq(evalResults.runId, runId));
    const survivingTask = await db.select().from(evalTasks).where(eq(evalTasks.id, taskId));

    expect(remainingSpans).toHaveLength(0);
    expect(remainingResults).toHaveLength(0);
    expect(survivingTask).toHaveLength(1);

    await db.delete(evalTasks).where(eq(evalTasks.id, taskId));
  });

  it("cascade-deletes child spans when their parent span is deleted directly", async () => {
    const runId = randomUUID();
    const parentId = randomUUID();
    const childId = randomUUID();
    const now = new Date();

    await db.insert(runs).values({ id: runId, task: `schema test parent-delete ${runId}`, status: "completed", startedAt: now });
    await db.insert(spans).values({ id: parentId, runId, parentSpanId: null, type: "tool_call", name: "parent", startedAt: now });
    await db.insert(spans).values({ id: childId, runId, parentSpanId: parentId, type: "tool_call", name: "child", startedAt: now });

    await db.delete(spans).where(eq(spans.id, parentId));

    const remainingChild = await db.select().from(spans).where(eq(spans.id, childId));
    expect(remainingChild).toHaveLength(0);

    await db.delete(runs).where(eq(runs.id, runId));
  });
});
