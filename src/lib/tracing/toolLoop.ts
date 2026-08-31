import type { Tracer } from "./tracer";
import { wrapChatCompletion, type GroqChatClient, type ChatMessage } from "./groq";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface RunAgentLoopOptions {
  tracer: Tracer;
  client: GroqChatClient;
  model: string;
  systemPrompt: string;
  userMessage: string;
  tools: ToolDefinition[];
  maxTurns?: number;
  maxTokens?: number;
}

/** The standard OpenAI-style tool-use loop: call the model, execute any
 * requested tools (each becomes its own `tool_call` span), feed the
 * results back as `role: "tool"` messages, repeat until the model stops
 * asking for tools or `maxTurns` is hit. A tool that throws is caught here
 * (not left to crash the loop) and turned into an error-prefixed tool
 * message, so the model can see the failure and retry on its own - that
 * retry is what produces the error/retry spans the dashboard is meant to
 * surface, driven by real model behavior rather than scripted synthetic
 * failures. */
export async function runAgentLoop(opts: RunAgentLoopOptions): Promise<string> {
  const { tracer, client, model, systemPrompt, userMessage, tools, maxTurns = 6, maxTokens = 1024 } = opts;
  const traced = wrapChatCompletion(client, tracer);
  const toolSpecs = tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await traced.chat.completions.create({ model, max_tokens: maxTokens, messages, tools: toolSpecs });
    const choice = response.choices[0];
    const message = choice.message;
    messages.push(message);

    if (choice.finish_reason !== "tool_calls" || !message.tool_calls || message.tool_calls.length === 0) {
      return message.content ?? "";
    }

    for (const call of message.tool_calls) {
      const tool = tools.find((t) => t.name === call.function.name);
      let resultContent: string;

      if (!tool) {
        resultContent = `Error: unknown tool "${call.function.name}"`;
      } else {
        let input: Record<string, unknown>;
        try {
          input = JSON.parse(call.function.arguments) as Record<string, unknown>;
        } catch {
          input = {};
        }
        try {
          const result = await tracer.span({ type: "tool_call", name: tool.name, input }, async (span) => {
            const output = await tool.handler(input);
            span.setOutput(output);
            return output;
          });
          resultContent = typeof result === "string" ? result : JSON.stringify(result);
        } catch (err) {
          resultContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      messages.push({ role: "tool", tool_call_id: call.id, content: resultContent });
    }
  }

  return "Reached the maximum number of turns without a final answer.";
}
