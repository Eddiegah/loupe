// Per-million-token USD pricing. Groq's free tier is genuinely free (no
// per-token charge) for the models this project uses as of this writing,
// so costMicros is expected to read $0 - the machinery below still runs
// for real (every span's tokenUsage is summed the same way regardless of
// price), it just multiplies by a zero rate. Swap in real per-model
// pricing here if you point Loupe at a paid model or provider.
export const MODEL_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "llama-3.3-70b-versatile": { inputPerMillion: 0, outputPerMillion: 0 },
  "llama-3.1-8b-instant": { inputPerMillion: 0, outputPerMillion: 0 },
};

const DEFAULT_PRICING = { inputPerMillion: 0, outputPerMillion: 0 };

/** Returns an estimated cost in USD micros (USD * 1e6) so callers can sum
 * costs with plain integer arithmetic instead of accumulating float error. */
export function estimateCostMicros(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const dollars = (inputTokens / 1_000_000) * pricing.inputPerMillion + (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return Math.round(dollars * 1_000_000);
}
