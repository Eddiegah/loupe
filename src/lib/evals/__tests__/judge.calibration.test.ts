import { describe, expect, it } from "vitest";
import { judgeOutput, createAnthropicJudgeClient } from "../judge";

const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

const RUBRIC =
  "The answer must correctly explain how to authenticate a webhook request against this API: it must mention verifying the X-Signature header using an HMAC-SHA256 signature computed with the account's webhook secret, and must NOT invent any endpoint, header, or mechanism that isn't in the docs.";

const cases: { label: string; output: string; expectRange: [number, number] }[] = [
  {
    label: "correct and complete",
    output:
      "To authenticate a webhook request, compute an HMAC-SHA256 signature of the raw request body using your account's webhook secret, then compare it to the value in the X-Signature header. Reject the request if they don't match.",
    expectRange: [4, 5],
  },
  {
    label: "fabricated mechanism",
    output:
      "To authenticate a webhook request, send your API key as a query parameter named ?auth_token= and the server will validate it against your account. This is documented under the /v2/webhooks/verify endpoint.",
    expectRange: [0, 1],
  },
  {
    label: "off-topic, ignores the question",
    output: "Webhooks are a great way to get real-time notifications. You can configure them in your dashboard under Settings.",
    expectRange: [0, 1],
  },
  {
    label: "partially correct, right idea but missing the mechanism",
    output: "You should check that the webhook request really came from us before trusting it. We sign our webhook requests so you can verify them.",
    expectRange: [1, 3],
  },
];

// This is the project's central credibility test: it doesn't just assert
// the judge returns *a* score, it proves the judge actually discriminates
// between known-good and known-bad answers, using hand-authored examples
// with an obvious correct verdict a human reviewer can check by eye.
// Skipped (not failed) without a real API key so CI without the secret
// still passes everything else.
describe.skipIf(!hasApiKey)("judgeOutput: calibration against known-good and known-bad answers", () => {
  it.each(cases)("scores a $label answer in the expected range", async ({ output, expectRange }) => {
    const client = createAnthropicJudgeClient();
    const verdict = await judgeOutput(client, RUBRIC, output);
    expect(verdict.score).toBeGreaterThanOrEqual(expectRange[0]);
    expect(verdict.score).toBeLessThanOrEqual(expectRange[1]);
    expect(verdict.rationale.length).toBeGreaterThan(0);
  }, 30000);

  it("separates an obviously-correct answer from an obviously-fabricated one by a wide margin", async () => {
    const client = createAnthropicJudgeClient();
    const good = await judgeOutput(client, RUBRIC, cases[0].output);
    const bad = await judgeOutput(client, RUBRIC, cases[1].output);
    // The actual proof this test exists for: the judge must discriminate,
    // not rubber-stamp every input with the same middling score.
    expect(good.score - bad.score).toBeGreaterThanOrEqual(3);
  }, 30000);
});
