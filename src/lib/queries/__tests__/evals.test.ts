import { describe, expect, it } from "vitest";
import { computeScoreCard } from "../evals";
import type { EvalResult } from "@/lib/db/schema";

function makeResult(overrides: Partial<EvalResult> & Pick<EvalResult, "id">): EvalResult {
  return {
    evalTaskId: "t",
    runId: "run",
    hardAssertionsPassed: true,
    judgeScore: 5,
    judgeRationale: "",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("computeScoreCard", () => {
  it("returns zeroed stats for a task with no results yet", () => {
    const card = computeScoreCard("t", []);
    expect(card).toEqual({ taskId: "t", totalRuns: 0, passRate: 0, averageJudgeScore: 0 });
  });

  it("counts a result as passing only when hard assertions pass AND the judge score meets the threshold", () => {
    const results = [
      makeResult({ id: "1", hardAssertionsPassed: true, judgeScore: 5 }),
      makeResult({ id: "2", hardAssertionsPassed: false, judgeScore: 5 }),
      makeResult({ id: "3", hardAssertionsPassed: true, judgeScore: 1 }),
      makeResult({ id: "4", hardAssertionsPassed: true, judgeScore: 3 }),
    ];

    const card = computeScoreCard("t", results, 3);

    expect(card.totalRuns).toBe(4);
    expect(card.passRate).toBe(0.5); // only results 1 and 4 pass
    expect(card.averageJudgeScore).toBe((5 + 5 + 1 + 3) / 4);
  });
});
