import Groq from "groq-sdk";
import { Tracer } from "../src/lib/tracing/tracer";
import { createExporter } from "../src/lib/tracing/exporter";
import { runAgentLoop } from "../src/lib/tracing/toolLoop";
import type { GroqChatClient } from "../src/lib/tracing/groq";
import { createTools } from "./tools";

export const MODEL = "openai/gpt-oss-120b";
export const SYSTEM_PROMPT =
  "You are a support assistant for an internal REST API. Answer questions using the tools " +
  "available to you: search_docs to find relevant pages, fetch_detail to read one in full, " +
  "calculate for any arithmetic, summarize for condensing long text. Never guess at API " +
  "behavior that isn't in the docs - if you can't find something, say so rather than " +
  "inventing it.";

export function createGroqClient(apiKey: string): GroqChatClient {
  const groq = new Groq({ apiKey });
  return {
    chat: {
      completions: {
        async create(params) {
          const response = await groq.chat.completions.create(params as unknown as Parameters<typeof groq.chat.completions.create>[0]);
          return response as unknown as Awaited<ReturnType<GroqChatClient["chat"]["completions"]["create"]>>;
        },
      },
    },
  };
}

export async function askAgent(question: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set - copy .env.local.example to .env.local");

  const client = createGroqClient(apiKey);
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
