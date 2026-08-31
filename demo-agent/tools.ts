import { readFileSync } from "node:fs";
import path from "node:path";
import type { Tracer } from "../src/lib/tracing/tracer";
import { wrapChatCompletion, type GroqChatClient } from "../src/lib/tracing/groq";
import type { ToolDefinition } from "../src/lib/tracing/toolLoop";

const KB_DIR = path.join(process.cwd(), "demo-agent", "knowledge-base");

interface DocIndexEntry {
  id: string;
  title: string;
  summary: string;
}

function loadIndex(): DocIndexEntry[] {
  const raw = readFileSync(path.join(KB_DIR, "index.json"), "utf-8");
  return JSON.parse(raw) as DocIndexEntry[];
}

function loadDoc(docId: string): string {
  return readFileSync(path.join(KB_DIR, `${docId}.md`), "utf-8");
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function scoreDoc(queryTokens: string[], docText: string): number {
  const docTokens = new Set(tokenize(docText));
  return queryTokens.filter((t) => docTokens.has(t)).length;
}

// A small, deliberately safe arithmetic evaluator (+ - * / and parens only)
// - not `eval`/`Function`, so a model-supplied expression can never
// execute arbitrary code.
class ExpressionError extends Error {}

function evaluateExpression(expr: string): number {
  let pos = 0;

  const peek = () => expr[pos];
  const consumeWhitespace = () => {
    while (pos < expr.length && /\s/.test(expr[pos])) pos++;
  };
  const parseNumber = (): number => {
    consumeWhitespace();
    const start = pos;
    if (peek() === "-") pos++;
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) pos++;
    const text = expr.slice(start, pos);
    if (!text || Number.isNaN(Number(text))) throw new ExpressionError(`Invalid number at position ${start}`);
    return Number(text);
  };
  const parseFactor = (): number => {
    consumeWhitespace();
    if (peek() === "(") {
      pos++;
      const value = parseExpr();
      consumeWhitespace();
      if (peek() !== ")") throw new ExpressionError("Expected closing parenthesis");
      pos++;
      return value;
    }
    return parseNumber();
  };
  const parseTerm = (): number => {
    let value = parseFactor();
    consumeWhitespace();
    while (peek() === "*" || peek() === "/") {
      const op = peek();
      pos++;
      const rhs = parseFactor();
      value = op === "*" ? value * rhs : value / rhs;
      consumeWhitespace();
    }
    return value;
  };
  function parseExpr(): number {
    let value = parseTerm();
    consumeWhitespace();
    while (peek() === "+" || peek() === "-") {
      const op = peek();
      pos++;
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
      consumeWhitespace();
    }
    return value;
  }

  const result = parseExpr();
  consumeWhitespace();
  if (pos !== expr.length) throw new ExpressionError(`Unexpected character at position ${pos}`);
  return result;
}

export function createTools(opts: { tracer: Tracer; client: GroqChatClient; model: string }): ToolDefinition[] {
  const index = loadIndex();
  const traced = wrapChatCompletion(opts.client, opts.tracer);

  const searchDocs: ToolDefinition = {
    name: "search_docs",
    description: "Keyword-search the API documentation. Returns matching doc ids, titles, and short summaries.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Search keywords" } },
      required: ["query"],
    },
    async handler(input) {
      const queryTokens = tokenize(String(input.query ?? ""));
      const scored = index
        .map((entry) => ({ entry, score: scoreDoc(queryTokens, `${entry.title} ${entry.summary}`) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);
      if (scored.length === 0) return { results: [], note: "No matching docs. Try different keywords." };
      return { results: scored.slice(0, 3).map((s) => ({ id: s.entry.id, title: s.entry.title, summary: s.entry.summary })) };
    },
  };

  const fetchDetail: ToolDefinition = {
    name: "fetch_detail",
    description: "Fetch the full content of one documentation page by its doc id (from search_docs results).",
    parameters: {
      type: "object",
      properties: { docId: { type: "string", description: "The doc id, e.g. 'webhooks'" } },
      required: ["docId"],
    },
    async handler(input) {
      const docId = String(input.docId ?? "");
      if (!index.some((entry) => entry.id === docId)) {
        // The deliberate, realistic failure mode: the model occasionally
        // guesses a doc id that doesn't exist. Thrown here, caught by the
        // tool loop, and turned into an error-prefixed tool message so the
        // model sees the mistake and can retry with a real id from
        // search_docs.
        throw new Error(`No such doc id "${docId}". Call search_docs first to find a valid id.`);
      }
      return { content: loadDoc(docId) };
    },
  };

  const calculate: ToolDefinition = {
    name: "calculate",
    description: "Evaluate an arithmetic expression (+ - * / and parentheses only). Use this for any numeric computation instead of doing the math yourself.",
    parameters: {
      type: "object",
      properties: { expression: { type: "string", description: "e.g. '100 * 90 / 60'" } },
      required: ["expression"],
    },
    async handler(input) {
      return { result: evaluateExpression(String(input.expression ?? "")) };
    },
  };

  const summarize: ToolDefinition = {
    name: "summarize",
    description: "Summarize a long piece of text down to at most maxWords words. Use this when a doc is too long to quote in full.",
    parameters: {
      type: "object",
      properties: { text: { type: "string" }, maxWords: { type: "number" } },
      required: ["text", "maxWords"],
    },
    async handler(input) {
      const text = String(input.text ?? "");
      const maxWords = Number(input.maxWords ?? 50);
      // A second, cheaper LLM call, nested inside this tool_call span -
      // this is what gives the trace waterfall real nesting instead of a
      // flat list of sibling calls.
      const response = await traced.chat.completions.create({
        model: opts.model,
        max_tokens: 200,
        messages: [{ role: "user", content: `Summarize the following in at most ${maxWords} words:\n\n${text}` }],
      });
      return { summary: response.choices[0]?.message.content ?? "" };
    },
  };

  return [searchDocs, fetchDetail, calculate, summarize];
}
