import type { Tracer } from "./tracer";
import type { TokenUsage } from "./types";

// A deliberately narrow, structurally-typed slice of Groq's (OpenAI-
// compatible) chat completions API - just enough to capture a span -
// rather than importing the full SDK's types here. Callers that hold a
// real Groq client adapt it to this shape at the boundary (see
// demo-agent/agent.ts), which keeps this module trivially unit-testable
// with a hand-built stub and gives it a stable surface if the SDK's own
// types shift.
export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface CreateChatCompletionParams {
  model: string;
  max_tokens?: number;
  messages: ChatMessage[];
  tools?: ToolSpec[];
}

export interface CreateChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

export interface CreateChatCompletionResponse {
  choices: { message: ChatMessage; finish_reason: string }[];
  usage: CreateChatCompletionUsage;
}

export interface GroqChatClient {
  chat: {
    completions: {
      create(params: CreateChatCompletionParams): Promise<CreateChatCompletionResponse>;
    };
  };
}

function mapUsage(usage: CreateChatCompletionUsage): TokenUsage {
  return { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens };
}

/** Wraps a chat-completions-shaped client so every `.chat.completions.create()`
 * call becomes one `llm_call` span - a one-line swap at the call site:
 * `const traced = wrapChatCompletion(client, tracer)`, then call
 * `traced.chat.completions.create(...)` exactly as you would the real client. */
export function wrapChatCompletion(client: GroqChatClient, tracer: Tracer): GroqChatClient {
  return {
    chat: {
      completions: {
        create(params) {
          return tracer.span(
            { type: "llm_call", name: params.model, input: { messages: params.messages, tools: params.tools } },
            async (span) => {
              const response = await client.chat.completions.create(params);
              span.setOutput(response.choices[0]?.message ?? null);
              if (response.usage) span.setTokenUsage(mapUsage(response.usage));
              return response;
            }
          );
        },
      },
    },
  };
}
