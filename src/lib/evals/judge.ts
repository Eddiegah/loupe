import Anthropic from "@anthropic-ai/sdk";

export interface JudgeVerdict {
  score: number;
  rationale: string;
}

const JUDGE_MODEL = process.env.LOUPE_JUDGE_MODEL ?? "claude-haiku-4-5-20251001";

function buildPrompt(rubric: string, output: string): string {
  return `You are grading an AI agent's answer against a rubric. Score strictly - do not be lenient.

Rubric:
${rubric}

Agent's answer:
${output}

Respond with ONLY a JSON object of the form {"score": <integer 0-5>, "rationale": "<one or two sentences>"}. No other text.`;
}

function parseVerdict(text: string): JudgeVerdict | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { score?: unknown; rationale?: unknown };
    if (typeof parsed.score !== "number" || typeof parsed.rationale !== "string") return null;
    return { score: Math.max(0, Math.min(5, Math.round(parsed.score))), rationale: parsed.rationale };
  } catch {
    return null;
  }
}

export interface JudgeClient {
  messages: {
    create(params: { model: string; max_tokens: number; messages: { role: "user"; content: string }[] }): Promise<{ content: unknown }>;
  };
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((b): b is { type: string; text: string } => typeof b === "object" && b !== null && (b as { type?: string }).type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** Scores an agent's output against a rubric using a Claude model as judge
 * (cheap/fast by default, see LOUPE_JUDGE_MODEL). Retries once on a
 * malformed response before giving up, since a strict-JSON instruction
 * occasionally still gets wrapped in prose. */
export async function judgeOutput(client: JudgeClient, rubric: string, output: string): Promise<JudgeVerdict> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: buildPrompt(rubric, output) }],
    });
    const verdict = parseVerdict(extractText(response.content));
    if (verdict) return verdict;
  }
  throw new Error("Judge did not return a parseable verdict after 2 attempts");
}

export function createAnthropicJudgeClient(): JudgeClient {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const anthropic = new Anthropic({ apiKey });
  return {
    messages: {
      create: (params) => anthropic.messages.create(params) as unknown as Promise<{ content: unknown }>,
    },
  };
}
