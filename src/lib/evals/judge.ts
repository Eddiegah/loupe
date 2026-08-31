import Groq from "groq-sdk";

export interface JudgeVerdict {
  score: number;
  rationale: string;
}

const JUDGE_MODEL = process.env.LOUPE_JUDGE_MODEL ?? "llama-3.1-8b-instant";

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
  chat: {
    completions: {
      create(params: { model: string; max_tokens: number; messages: { role: "user"; content: string }[] }): Promise<{
        choices: { message: { content: string | null } }[];
      }>;
    };
  };
}

/** Scores an agent's output against a rubric using a Groq chat model as
 * judge (cheap/fast by default, see LOUPE_JUDGE_MODEL). Retries once on a
 * malformed response before giving up, since a strict-JSON instruction
 * occasionally still gets wrapped in prose. */
export async function judgeOutput(client: JudgeClient, rubric: string, output: string): Promise<JudgeVerdict> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.chat.completions.create({
      model: JUDGE_MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: buildPrompt(rubric, output) }],
    });
    const verdict = parseVerdict(response.choices[0]?.message.content ?? "");
    if (verdict) return verdict;
  }
  throw new Error("Judge did not return a parseable verdict after 2 attempts");
}

export function createGroqJudgeClient(): JudgeClient {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  const groq = new Groq({ apiKey });
  return {
    chat: {
      completions: {
        create: async (params) => {
          const response = await groq.chat.completions.create(params as unknown as Parameters<typeof groq.chat.completions.create>[0]);
          return response as unknown as { choices: { message: { content: string | null } }[] };
        },
      },
    },
  };
}
