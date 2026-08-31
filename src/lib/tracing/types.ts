export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export type SpanType = "llm_call" | "tool_call";

export interface SpanRecord {
  id: string;
  runId: string;
  parentSpanId: string | null;
  type: SpanType;
  name: string;
  input: unknown;
  output: unknown;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  tokenUsage: TokenUsage | null;
  error: string | null;
}
