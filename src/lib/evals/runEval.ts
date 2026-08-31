import { getRun, getRunSpans } from "@/lib/queries/runs";
import { Tracer } from "@/lib/tracing/tracer";
import type { Exporter } from "@/lib/tracing/exporter";
import type { AnthropicMessagesClient } from "@/lib/tracing/anthropic";
import { runAgentLoop, type ToolDefinition } from "@/lib/tracing/toolLoop";
import { checkAssertions, type Assertion } from "./assertions";
import { judgeOutput, type JudgeClient } from "./judge";

export interface EvalTaskInput {
  prompt: string;
  hardAssertions: Assertion[];
  rubric: string;
}

export interface RunEvalOptions {
  exporter: Exporter;
  client: AnthropicMessagesClient;
  judgeClient: JudgeClient;
  model: string;
  systemPrompt: string;
  // Takes a factory rather than a prebuilt ToolDefinition[] so the tools
  // (specifically the "summarize" tool's nested LLM call) are bound to the
  // exact same Tracer instance that runs this trace - building them ahead
  // of time against a different Tracer would silently break span nesting.
  createTools: (tracer: Tracer) => ToolDefinition[];
  task: EvalTaskInput;
}

export interface RunEvalResult {
  runId: string;
  finalOutput: string;
  hardAssertionsPassed: boolean;
  assertionDetails: string[];
  judgeScore: number;
  judgeRationale: string;
}

/** Runs one eval task against the demo agent as a real traced run (so it
 * shows up under /runs like any other invocation), then grades it with
 * both hard programmatic assertions and an LLM-as-judge score. */
export async function runEval(opts: RunEvalOptions): Promise<RunEvalResult> {
  const tracer = new Tracer(opts.exporter);
  const fallbackStartedAt = Date.now();

  const { result: finalOutput, runId } = await tracer.startTrace(opts.task.prompt, (t) =>
    runAgentLoop({
      tracer: t,
      client: opts.client,
      model: opts.model,
      systemPrompt: opts.systemPrompt,
      userMessage: opts.task.prompt,
      tools: opts.createTools(t),
    })
  );

  // Spans were already flushed to Postgres by the exporter during the
  // trace above - read them back the same way the dashboard would, rather
  // than threading a separate in-memory copy through this function.
  const run = await getRun(runId);
  const spans = await getRunSpans(runId);
  const durationMs = run?.endedAt ? run.endedAt.getTime() - run.startedAt.getTime() : Date.now() - fallbackStartedAt;

  const { passed, results } = checkAssertions(opts.task.hardAssertions, { spans, finalOutput, durationMs });
  const verdict = await judgeOutput(opts.judgeClient, opts.task.rubric, finalOutput);

  return {
    runId,
    finalOutput,
    hardAssertionsPassed: passed,
    assertionDetails: results.map((r) => r.detail),
    judgeScore: verdict.score,
    judgeRationale: verdict.rationale,
  };
}
