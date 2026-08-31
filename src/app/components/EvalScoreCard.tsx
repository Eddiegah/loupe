import Link from "next/link";
import type { EvalTask } from "@/lib/db/schema";
import type { ScoreCard } from "@/lib/queries/evals";

export function EvalScoreCard({ task, scoreCard }: { task: EvalTask; scoreCard: ScoreCard }) {
  const passPct = Math.round(scoreCard.passRate * 100);
  return (
    <Link href={`/evals/${task.id}`} className="block rounded-2xl border border-border bg-surface p-4 hover:border-accent">
      <div className="mb-2 text-sm font-medium text-foreground">{task.name}</div>
      <div className="flex items-center gap-4 text-xs text-muted">
        <span>
          {scoreCard.totalRuns} run{scoreCard.totalRuns === 1 ? "" : "s"}
        </span>
        <span className={passPct >= 70 ? "text-[var(--status-success)]" : passPct > 0 ? "text-[var(--status-running)]" : "text-muted"}>{passPct}% pass rate</span>
        <span>avg score {scoreCard.averageJudgeScore.toFixed(1)}/5</span>
      </div>
    </Link>
  );
}
