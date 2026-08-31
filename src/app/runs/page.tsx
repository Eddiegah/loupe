import Link from "next/link";
import { listRuns } from "@/lib/queries/runs";
import { RunStatusBadge } from "@/app/components/RunStatusBadge";
import { TokenCostBadge } from "@/app/components/TokenCostBadge";
import { RunFilters } from "@/app/components/RunFilters";

export default async function RunsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const allRuns = await listRuns();
  const runs = status && status !== "all" ? allRuns.filter((r) => r.status === status) : allRuns;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Runs</h1>
        <p className="mt-1 text-sm text-muted">Every traced agent invocation, most recent first.</p>
      </div>

      <RunFilters current={status ?? "all"} />

      {runs.length === 0 ? (
        <p className="text-sm text-muted">
          No runs yet. Generate one with <code className="rounded bg-surface px-1 py-0.5 font-mono">npm run demo-agent -- &quot;your question&quot;</code>.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Usage</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-4 py-3">
                    <Link href={`/runs/${run.id}`} className="font-medium text-foreground hover:text-accent">
                      {run.task}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <TokenCostBadge tokens={run.totalTokens} costMicros={run.totalCostMicros} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
