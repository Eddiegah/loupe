import { randomUUID } from "node:crypto";
import { db, sql } from "../src/lib/db";
import { evalTasks, evalResults } from "../src/lib/db/schema";
import { createExporter } from "../src/lib/tracing/exporter";
import { createAnthropicJudgeClient } from "../src/lib/evals/judge";
import { runEval } from "../src/lib/evals/runEval";
import { createAnthropicClient, MODEL, SYSTEM_PROMPT } from "../demo-agent/agent";
import { createTools } from "../demo-agent/tools";
import type { Assertion } from "../src/lib/evals/assertions";

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set - copy .env.local.example to .env.local");

  const tasks = await db.select().from(evalTasks);
  if (tasks.length === 0) {
    console.log("No eval tasks found - run `npm run db:seed` first.");
    return;
  }

  const client = createAnthropicClient(apiKey);
  const judgeClient = createAnthropicJudgeClient();

  console.log(`Running ${tasks.length} eval task(s)...\n`);

  for (const task of tasks) {
    const result = await runEval({
      exporter: createExporter(),
      client,
      judgeClient,
      model: MODEL,
      systemPrompt: SYSTEM_PROMPT,
      createTools: (tracer) => createTools({ tracer, client, model: MODEL }),
      task: {
        prompt: task.prompt,
        hardAssertions: task.hardAssertions as Assertion[],
        rubric: task.rubric,
      },
    });

    await db.insert(evalResults).values({
      id: randomUUID(),
      evalTaskId: task.id,
      runId: result.runId,
      hardAssertionsPassed: result.hardAssertionsPassed,
      judgeScore: result.judgeScore,
      judgeRationale: result.judgeRationale,
    });

    const status = result.hardAssertionsPassed ? "PASS" : "FAIL";
    console.log(`[${status}] ${task.name} - judge score ${result.judgeScore}/5`);
    if (!result.hardAssertionsPassed) {
      for (const detail of result.assertionDetails) console.log(`    ${detail}`);
    }
  }

  console.log("\nDone. View results at /evals.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
