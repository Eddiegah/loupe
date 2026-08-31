import { listEvalTasks, getResultsForTask, computeScoreCard } from "@/lib/queries/evals";
import { EvalScoreCard } from "@/app/components/EvalScoreCard";

// Scorecards change every time `npm run eval` runs - never serve a build-time
// snapshot of this page.
export const dynamic = "force-dynamic";

export default async function EvalsPage() {
  const tasks = await listEvalTasks();
  const cards = await Promise.all(tasks.map(async (task) => ({ task, scoreCard: computeScoreCard(task.id, await getResultsForTask(task.id)) })));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Evals</h1>
        <p className="mt-1 text-sm text-muted">Hard-assertion + judge-scored tasks run against the demo agent.</p>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted">
          No eval tasks yet. Run <code className="rounded bg-surface px-1 py-0.5 font-mono">npm run db:seed</code> then{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono">npm run eval</code>.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map(({ task, scoreCard }) => (
            <EvalScoreCard key={task.id} task={task} scoreCard={scoreCard} />
          ))}
        </div>
      )}
    </div>
  );
}
