// Per-million-token USD pricing. Anthropic's pricing changes over time and
// this table is not kept in sync automatically - treat costMicros as an
// estimate for the dashboard, never as an authoritative billing figure.
export const MODEL_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "claude-sonnet-5": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-haiku-4-5-20251001": { inputPerMillion: 1, outputPerMillion: 5 },
  "claude-opus-5": { inputPerMillion: 15, outputPerMillion: 75 },
};

const DEFAULT_PRICING = { inputPerMillion: 3, outputPerMillion: 15 };

/** Returns an estimated cost in USD micros (USD * 1e6) so callers can sum
 * costs with plain integer arithmetic instead of accumulating float error. */
export function estimateCostMicros(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const dollars = (inputTokens / 1_000_000) * pricing.inputPerMillion + (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return Math.round(dollars * 1_000_000);
}
