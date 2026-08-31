# Loupe

[![CI](https://github.com/Eddiegah/loupe/actions/workflows/ci.yml/badge.svg)](https://github.com/Eddiegah/loupe/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/demo-live-3ecf8e?logo=vercel&logoColor=white)](https://loupe-orcin.vercel.app)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)

**[Live demo](https://loupe-orcin.vercel.app)**

A flight recorder for AI agents. When an agent answers a question it takes a
bunch of steps behind the scenes - search, read a doc, run a calculation,
decide it has enough to answer - and right now all of that is invisible.
Loupe instruments an agent's own tool-use loop, records every step (what it
decided, how long each step took, what it cost), and shows it on a
dashboard: a waterfall view of a single run, a side-by-side diff of two
runs, and a scorecard grading runs against an eval suite.

Everything here is original: the tracing SDK, the demo agent, and the eval
harness are all built directly on Groq's (OpenAI-compatible) chat
completions API, not a wrapper around an existing observability product or
agent framework. Groq was chosen specifically because its free tier means
the live demo, the eval harness, and CI's judge-calibration test all run
for real, for free.

## Why this is real, not a demo

- **The LLM-as-judge is checked against known-good and known-bad answers,
  not just assumed to work because it returns a number.**
  `judge.calibration.test.ts` hand-authors answers that are obviously
  correct, obviously fabricated, off-topic, or partially right, then
  asserts the judge's scores actually land in the expected range for each -
  and that a correct answer scores at least 3 points higher than a
  fabricated one. A judge that rubber-stamps everything with a 4 would fail
  this test.
- **Nested span parenting is proven, not assumed.** `tracer.test.ts` opens
  spans inside spans and asserts the child's `parentSpanId` is exactly the
  parent's `id` - and that a span whose handler throws still closes
  cleanly (records the error, sets `endedAt`) before rethrowing.
- **Token/cost totals are recomputed server-side, not trusted from the
  client.** The ingestion route sums every span's token usage itself; a
  round-trip test (`ingestTrace.test.ts`) posts a synthetic trace against a
  real local Postgres and asserts what comes back matches what was sent -
  and that the total wasn't just copied from the request body.
- **Cascade/survival behavior is tested against a real database**, not
  inferred from the schema: deleting a run cascades to its spans and eval
  results but leaves the eval task itself untouched; deleting a parent span
  cascades to its children.

## Architecture

```
src/lib/
  db/                Drizzle schema (runs, spans, eval_tasks, eval_results)
  tracing/           the instrumentation SDK - framework-agnostic, no
                      React/Next imports
    tracer.ts          Tracer: AsyncLocalStorage-based span nesting
    groq.ts              wrapChatCompletion() - one-line swap at a call site
    toolLoop.ts          the standard call-model / execute-tools loop
    exporter.ts           buffers spans, flushes batched to /api/traces
  ingestion/         POST /api/traces handler - upserts the run, inserts
                      spans, recomputes totals server-side
  evals/
    assertions.ts       hard programmatic checks (must_call_tool, etc.)
    judge.ts              LLM-as-judge scoring against a rubric
    runEval.ts              runs one eval task as a real traced run
  queries/           read-side queries + span-tree assembly for the UI

demo-agent/          a small internal-API-docs support agent, built on the
                      SDK above (dogfooding) - 4 tools, a fixed knowledge
                      base, one deliberate failure mode (a hallucinated doc
                      id) to produce real error/retry spans

src/app/
  api/traces/          ingestion endpoint
  runs/, runs/[id]/,
  runs/compare/         the trace dashboard
  evals/, evals/[id]/   eval scorecards and per-task results
```

## Local development

```bash
npm install
docker run -d --name loupe-postgres -p 5432:5432 \
  -e POSTGRES_USER=loupe -e POSTGRES_PASSWORD=loupe_dev_password -e POSTGRES_DB=loupe \
  postgres:16-alpine
npm run db:migrate
npm run db:seed          # seeds ~12 eval tasks

# .env.local needs GROQ_API_KEY - free at console.groq.com (see .env.local.example)
npm run dev               # dashboard at http://localhost:3000

npm run demo-agent -- "How do I authenticate a webhook request?"
npm run eval               # runs every seeded eval task against the demo agent
npm test
```

## Deliberately out of scope for v1

- Multi-provider support - Groq only, no Anthropic/OpenAI/other SDKs.
- Real-time/live-streaming trace view - traces appear after the run
  completes, not tailed live.
- Auth / multi-tenancy - single-user demo, like the rest of this portfolio.
- Regression/anomaly alerting on eval score trends over time.
- Publishing the tracing SDK as a standalone npm package.
- True LCS-based diff alignment in the compare view - runs are aligned by
  step index, not by matching similar steps across a run with extra or
  missing steps.
- `pricing.ts`'s cost table reflects Groq's free-tier pricing ($0) for the
  models used here - the summing/estimation machinery is real and would
  show real dollar figures against a paid model, it's just multiplying by
  zero today.

## License

MIT © [Edmund Eric Gah](https://github.com/Eddiegah) - see [LICENSE](LICENSE).
