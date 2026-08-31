function formatCost(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}

export function TokenCostBadge({ tokens, costMicros }: { tokens: number; costMicros: number }) {
  return (
    <span className="font-mono text-xs text-muted">
      {tokens.toLocaleString()} tok &middot; {formatCost(costMicros)}
    </span>
  );
}
