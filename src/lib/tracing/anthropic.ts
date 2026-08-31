import type { Tracer } from "./tracer";
import type { TokenUsage } from "./types";

// A deliberately narrow, structurally-typed slice of the Anthropic Messages
// API - just enough to capture a span - rather than importing the full SDK's
// (overloaded, streaming-aware) types here. Callers that hold a real
// `Anthropic` instance adapt it to this shape at the boundary (see
// demo-agent/agent.ts), which keeps this module trivially unit-testable
// with a hand-built stub and gives it a stable surface if the SDK's own
// types shift.
export interface CreateMessageParams {
  model: string;
  max_tokens: number;
  system?: string;
  messages: unknown[];
  tools?: unknown[];
}

export interface CreateMessageUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export interface CreateMessageResponse {
  content: unknown;
  stop_reason: string | null;
  usage: CreateMessageUsage;
}

export interface AnthropicMessagesClient {
  messages: {
    create(params: CreateMessageParams): Promise<CreateMessageResponse>;
  };
}

function mapUsage(usage: CreateMessageUsage): TokenUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? undefined,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? undefined,
  };
}

/** Wraps a Messages-API-shaped client so every `.messages.create()` call
 * becomes one `llm_call` span - a one-line swap at the call site:
 * `const traced = wrapMessagesCreate(client, tracer)`, then call
 * `traced.messages.create(...)` exactly as you would the real client. */
export function wrapMessagesCreate(client: AnthropicMessagesClient, tracer: Tracer): AnthropicMessagesClient {
  return {
    messages: {
      create(params) {
        return tracer.span(
          { type: "llm_call", name: params.model, input: { system: params.system, messages: params.messages, tools: params.tools } },
          async (span) => {
            const response = await client.messages.create(params);
            span.setOutput(response.content);
            if (response.usage) span.setTokenUsage(mapUsage(response.usage));
            return response;
          }
        );
      },
    },
  };
}
