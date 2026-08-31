import { describe, expect, it } from "vitest";
import { Tracer } from "../tracer";
import { wrapMessagesCreate, type AnthropicMessagesClient, type CreateMessageResponse } from "../anthropic";
import type { Exporter } from "../exporter";
import type { SpanRecord } from "../types";

function createFakeExporter() {
  const spans: SpanRecord[] = [];
  const exporter: Exporter = {
    addSpan(span) {
      spans.push(span);
    },
    async flush() {},
  };
  return { exporter, spans };
}

describe("wrapMessagesCreate: token usage capture", () => {
  it("records the stub response's usage exactly on the span", async () => {
    const { exporter, spans } = createFakeExporter();
    const tracer = new Tracer(exporter);

    const stubResponse: CreateMessageResponse = {
      content: [{ type: "text", text: "hi" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 42, output_tokens: 7, cache_read_input_tokens: 3, cache_creation_input_tokens: 0 },
    };
    const client: AnthropicMessagesClient = {
      messages: { create: async () => stubResponse },
    };

    await tracer.startTrace("t", async (t) => {
      const traced = wrapMessagesCreate(client, t);
      await traced.messages.create({ model: "claude-sonnet-5", max_tokens: 10, messages: [] });
    });

    const span = spans.find((s) => s.type === "llm_call")!;
    expect(span.tokenUsage).toEqual({
      inputTokens: 42,
      outputTokens: 7,
      cacheReadTokens: 3,
      cacheWriteTokens: 0,
    });
    expect(span.name).toBe("claude-sonnet-5");
    expect(span.error).toBeNull();
  });

  it("records the error and still rethrows when the client throws", async () => {
    const { exporter, spans } = createFakeExporter();
    const tracer = new Tracer(exporter);
    const client: AnthropicMessagesClient = {
      messages: {
        create: async () => {
          throw new Error("rate limited");
        },
      },
    };

    await expect(
      tracer.startTrace("t", async (t) => {
        const traced = wrapMessagesCreate(client, t);
        await traced.messages.create({ model: "claude-sonnet-5", max_tokens: 10, messages: [] });
      })
    ).rejects.toThrow("rate limited");

    const span = spans.find((s) => s.type === "llm_call")!;
    expect(span.error).toBe("rate limited");
    expect(span.tokenUsage).toBeNull();
  });
});
