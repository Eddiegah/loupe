import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { evalTasks, evalResults, type EvalTask, type EvalResult } from "@/lib/db/schema";

export async function listEvalTasks(): Promise<EvalTask[]> {
  return db.select().from(evalTasks).orderBy(evalTasks.name);
}

export async function getEvalTask(taskId: string): Promise<EvalTask | undefined> {
  const rows = await db.select().from(evalTasks).where(eq(evalTasks.id, taskId)).limit(1);
  return rows[0];
}

export async function getResultsForTask(taskId: string): Promise<EvalResult[]> {
  return db.select().from(evalResults).where(eq(evalResults.evalTaskId, taskId)).orderBy(desc(evalResults.createdAt));
}

export interface ScoreCard {
  taskId: string;
  totalRuns: number;
  passRate: number;
  averageJudgeScore: number;
}

/** A result counts as passing only when BOTH the hard assertions passed
 * and the judge score clears the threshold - a well-formed output that a
 * hard assertion catches as wrong (e.g. it skipped a required tool call)
 * shouldn't be rescued by a lenient judge score, or vice versa. */
export function computeScoreCard(taskId: string, results: EvalResult[], passThreshold = 3): ScoreCard {
  if (results.length === 0) return { taskId, totalRuns: 0, passRate: 0, averageJudgeScore: 0 };
  const passing = results.filter((r) => r.hardAssertionsPassed && r.judgeScore >= passThreshold);
  const averageJudgeScore = results.reduce((sum, r) => sum + r.judgeScore, 0) / results.length;
  return {
    taskId,
    totalRuns: results.length,
    passRate: passing.length / results.length,
    averageJudgeScore,
  };
}
