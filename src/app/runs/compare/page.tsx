import { getRun, getRunSpans, buildSpanTree, listRuns } from "@/lib/queries/runs";
import { CompareView } from "@/app/components/CompareView";

async function RunPicker({ name, label, selected, runs }: { name: string; label: string; selected?: string; runs: Awaited<ReturnType<typeof listRuns>> }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-foreground">{label}</span>
      <select name={name} defaultValue={selected ?? ""} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
        <option value="">Select a run&hellip;</option>
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {run.task} ({new Date(run.startedAt).toLocaleString()})
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  const allRuns = await listRuns(100);

  const [runA, runB] = await Promise.all([a ? getRun(a) : undefined, b ? getRun(b) : undefined]);
  const [spansA, spansB] = await Promise.all([a ? getRunSpans(a) : Promise.resolve([]), b ? getRunSpans(b) : Promise.resolve([])]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-foreground">Compare runs</h1>
      <form className="mb-6 grid gap-4 sm:grid-cols-2" action="/runs/compare">
        <RunPicker name="a" label="Run A" selected={a} runs={allRuns} />
        <RunPicker name="b" label="Run B" selected={b} runs={allRuns} />
        <button type="submit" className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 sm:col-span-2">
          Compare
        </button>
      </form>

      {runA && runB ? (
        <CompareView runA={{ run: runA, tree: buildSpanTree(spansA) }} runB={{ run: runB, tree: buildSpanTree(spansB) }} />
      ) : (
        <p className="text-sm text-muted">Pick two runs above to compare their step-by-step traces.</p>
      )}
    </div>
  );
}
