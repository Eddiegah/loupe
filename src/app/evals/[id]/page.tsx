import { notFound } from "next/navigation";
import Link from "next/link";
import { getEvalTask, getResultsForTask } from "@/lib/queries/evals";
import { JudgeRationale } from "@/app/components/JudgeRationale";

export default async function EvalTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getEvalTask(id);
  if (!task) notFound();

  const results = await getResultsForTask(id);

  return (
    <div>
      <Link href="/evals" className="text-sm text-muted hover:text-foreground">
        &larr; All evals
      </Link>
      <div className="mt-2 mb-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{task.name}</h1>
        <p className="mt-1 text-sm text-muted">{task.prompt}</p>
      </div>
      <p className="mb-6 text-xs text-muted">Rubric: {task.rubric}</p>

      {results.length === 0 ? (
        <p className="text-sm text-muted">
          No results yet - run <code className="rounded bg-surface px-1 py-0.5 font-mono">npm run eval</code>.
        </p>
      ) : (
        <div className="space-y-3">
          {results.map((result) => (
            <div key={result.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <Link href={`/runs/${result.runId}`} className="font-medium text-accent hover:underline">
                  View trace &rarr;
                </Link>
                <span className={result.hardAssertionsPassed ? "text-[var(--status-success)]" : "text-[var(--status-error)]"}>
                  {result.hardAssertionsPassed ? "assertions passed" : "assertions failed"}
                </span>
              </div>
              <JudgeRationale score={result.judgeScore} rationale={result.judgeRationale} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
