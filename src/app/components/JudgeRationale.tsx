export function JudgeRationale({ score, rationale }: { score: number; rationale: string }) {
  return (
    <div className="rounded-lg bg-background p-3 text-sm">
      <div className="mb-1 font-medium text-foreground">Judge score: {score}/5</div>
      <p className="text-muted">{rationale}</p>
    </div>
  );
}
