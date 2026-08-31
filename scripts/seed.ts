import { randomUUID } from "node:crypto";
import { db, sql } from "../src/lib/db";
import { evalTasks } from "../src/lib/db/schema";
import type { Assertion } from "../src/lib/evals/assertions";

interface SeedTask {
  name: string;
  prompt: string;
  hardAssertions: Assertion[];
  rubric: string;
}

const TASKS: SeedTask[] = [
  {
    name: "Authenticate a webhook request",
    prompt: "How do I authenticate a webhook request to make sure it really came from you?",
    hardAssertions: [
      { kind: "must_call_tool", tool: "search_docs" },
      { kind: "must_call_tool", tool: "fetch_detail" },
      { kind: "must_not_call_tool", tool: "calculate" },
      { kind: "output_contains", text: "signature" },
    ],
    rubric:
      "The answer must explain verifying the X-Signature header via an HMAC-SHA256 signature computed with the account's webhook secret, and must not invent an endpoint or mechanism not in the docs.",
  },
  {
    name: "Rate limit window math",
    prompt: "If the rate limit is 100 requests per minute, how many requests can I make in a 90 second window?",
    hardAssertions: [{ kind: "must_call_tool", tool: "calculate" }],
    rubric: "The answer must correctly compute 150 requests (100 req/min * 1.5 min) and show the arithmetic, not just assert a number.",
  },
  {
    name: "401 vs 403",
    prompt: "What's the difference between a 401 and a 403 error from this API?",
    hardAssertions: [
      { kind: "must_call_tool", tool: "fetch_detail" },
      { kind: "output_contains", text: "403" },
    ],
    rubric:
      "The answer must correctly distinguish 401 (authentication failure - who you are) from 403 (authorization failure - what you're allowed to do), matching the docs.",
  },
  {
    name: "Unanswerable question (fabrication trap)",
    prompt: "What's the maximum file size for uploading a user avatar image?",
    hardAssertions: [{ kind: "must_not_call_tool", tool: "calculate" }],
    rubric:
      "There is no avatar upload feature in the docs. The answer must say this isn't documented rather than inventing a file size limit or an upload endpoint.",
  },
  {
    name: "Idempotency keys for payments",
    prompt: "How do I safely retry a charge request without accidentally charging the customer twice?",
    hardAssertions: [
      { kind: "must_call_tool", tool: "fetch_detail" },
      { kind: "output_contains", text: "idempotency" },
    ],
    rubric: "The answer must mention the Idempotency-Key header and that it's the only supported safe-retry mechanism, matching the docs.",
  },
  {
    name: "Partial refund",
    prompt: "Can I refund only part of a charge, and if so how?",
    hardAssertions: [{ kind: "must_call_tool", tool: "fetch_detail" }],
    rubric: "The answer must describe POST /v1/charges/{id}/refunds with a partial amount, matching the docs.",
  },
  {
    name: "Webhook retry policy",
    prompt: "What happens if my webhook endpoint is down when you try to deliver an event?",
    hardAssertions: [{ kind: "must_call_tool", tool: "fetch_detail" }],
    rubric: "The answer must describe the exponential backoff retry schedule and that delivery is eventually marked permanently failed, matching the docs.",
  },
  {
    name: "Deleted user retention window",
    prompt: "If I delete a user, how long until the data is actually gone for good?",
    hardAssertions: [{ kind: "output_contains", text: "30" }],
    rubric: "The answer must state the 30-day soft-delete retention window before permanent purge, matching the docs.",
  },
  {
    name: "Bulk operation record cap",
    prompt: "How many records can I include in a single bulk user import call?",
    hardAssertions: [{ kind: "output_contains", text: "500" }],
    rubric: "The answer must state the 500-record cap per bulk call, matching the docs.",
  },
  {
    name: "Rate limit scope",
    prompt: "Is the rate limit shared across my whole account, or separate per API key?",
    hardAssertions: [{ kind: "output_contains", text: "key" }],
    rubric: "The answer must correctly state the rate limit is per API key, not per account, matching the docs.",
  },
  {
    name: "Simple header lookup (latency-bounded)",
    prompt: "Which HTTP header do I put my API key in?",
    hardAssertions: [
      { kind: "output_contains", text: "Authorization" },
      { kind: "max_latency_ms", ms: 30000 },
    ],
    rubric: "The answer must state the Authorization header with the Bearer scheme, matching the docs.",
  },
  {
    name: "Idempotency window length",
    prompt: "For how long is a charge request with the same Idempotency-Key treated as a duplicate?",
    hardAssertions: [{ kind: "output_contains", text: "24" }],
    rubric: "The answer must state the 24-hour idempotency window, matching the docs.",
  },
];

async function main() {
  const existing = await db.select().from(evalTasks).limit(1);
  if (existing.length > 0) {
    console.log("eval_tasks already has rows - skipping seed (delete rows manually to reseed).");
    return;
  }

  await db.insert(evalTasks).values(
    TASKS.map((t) => ({
      id: randomUUID(),
      name: t.name,
      prompt: t.prompt,
      hardAssertions: t.hardAssertions,
      rubric: t.rubric,
    }))
  );

  console.log(`Seeded ${TASKS.length} eval tasks.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
