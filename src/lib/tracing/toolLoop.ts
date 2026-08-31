import type { Tracer } from "./tracer";
import { wrapMessagesCreate, type AnthropicMessagesClient } from "./anthropic";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

interface ContentBlock {
  type: string;
  [key: string]: unknown;
}

interface ToolUseBlock extends ContentBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface TextBlock extends ContentBlock {
  type: "text";
  text: string;
}

export interface RunAgentLoopOptions {
  tracer: Tracer;
  client: AnthropicMessagesClient;
  model: string;
  systemPrompt: string;
  userMessage: string;
  tools: ToolDefinition[];
  maxTurns?: number;
  maxTokens?: number;
}

/** The standard Anthropic tool-use loop: call the model, execute any
 * requested tools (each becomes its own `tool_call` span), feed the results
 * back, repeat until the model stops asking for tools or `maxTurns` is hit.
 * A tool that throws is caught here (not left to crash the loop) and turned
 * into an `is_error` tool_result, so the model can see the failure and
 * retry on its own - that retry is what produces the error/retry spans the
 * dashboard is meant to surface, driven by real model behavior rather than
 * scripted synthetic failures. */
export async function runAgentLoop(opts: RunAgentLoopOptions): Promise<string> {
  const { tracer, client, model, systemPrompt, userMessage, tools, maxTurns = 6, maxTokens = 1024 } = opts;
  const traced = wrapMessagesCreate(client, tracer);
  const toolDefs = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [{ role: "user", content: userMessage }];

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await traced.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      tools: toolDefs,
    });

    const content = response.content as ContentBlock[];
    messages.push({ role: "assistant", content });

    const toolUseBlocks = content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
      const textBlocks = content.filter((b): b is TextBlock => b.type === "text");
      return textBlocks.map((b) => b.text).join("\n");
    }

    const toolResults = [];
    for (const block of toolUseBlocks) {
      const tool = tools.find((t) => t.name === block.name);
      let resultContent: string;
      let isError = false;

      if (!tool) {
        resultContent = `Unknown tool: ${block.name}`;
        isError = true;
      } else {
        try {
          const result = await tracer.span({ type: "tool_call", name: tool.name, input: block.input }, async (span) => {
            const output = await tool.handler(block.input);
            span.setOutput(output);
            return output;
          });
          resultContent = typeof result === "string" ? result : JSON.stringify(result);
        } catch (err) {
          resultContent = err instanceof Error ? err.message : String(err);
          isError = true;
        }
      }

      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultContent, is_error: isError });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return "Reached the maximum number of turns without a final answer.";
}
