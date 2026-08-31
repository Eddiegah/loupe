import Anthropic from "@anthropic-ai/sdk";
import { Tracer } from "../src/lib/tracing/tracer";
import { createExporter } from "../src/lib/tracing/exporter";
import { runAgentLoop } from "../src/lib/tracing/toolLoop";
import type { AnthropicMessagesClient } from "../src/lib/tracing/anthropic";
import { createTools } from "./tools";

export const MODEL = "claude-sonnet-5";
export const SYSTEM_PROMPT =
  "You are a support assistant for an internal REST API. Answer questions using the tools " +
  "available to you: search_docs to find relevant pages, fetch_detail to read one in full, " +
  "calculate for any arithmetic, summarize for condensing long text. Never guess at API " +
  "behavior that isn't in the docs - if you can't find something, say so rather than " +
  "inventing it.";

export function createAnthropicClient(apiKey: string): AnthropicMessagesClient {
  const anthropic = new Anthropic({ apiKey });
  return {
    messages: {
      async create(params) {
        const response = await anthropic.messages.create(params as unknown as Parameters<typeof anthropic.messages.create>[0]);
        return response as unknown as Awaited<ReturnType<AnthropicMessagesClient["messages"]["create"]>>;
      },
    },
  };
}

export async function askAgent(question: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set - copy .env.local.example to .env.local");

  const client = createAnthropicClient(apiKey);
  const exporter = createExporter();
  const tracer = new Tracer(exporter);
  const tools = createTools({ tracer, client, model: MODEL });

  return tracer.startTrace(question, (t) =>
    runAgentLoop({
      tracer: t,
      client,
      model: MODEL,
      systemPrompt: SYSTEM_PROMPT,
      userMessage: question,
      tools,
    })
  );
}

async function main() {
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) {
    console.error('Usage: npm run demo-agent -- "your question"');
    process.exitCode = 1;
    return;
  }

  const { result, runId } = await askAgent(question);
  console.log(`\nRun: ${runId}\n`);
  console.log(result);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
