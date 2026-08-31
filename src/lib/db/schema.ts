import { relations } from "drizzle-orm";
import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar, type AnyPgColumn } from "drizzle-orm/pg-core";

export const runStatusEnum = pgEnum("run_status", ["running", "completed", "failed"]);
export const spanTypeEnum = pgEnum("span_type", ["llm_call", "tool_call"]);

export const runs = pgTable("runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  task: varchar("task", { length: 300 }).notNull(),
  label: varchar("label", { length: 120 }),
  status: runStatusEnum("status").notNull().default("running"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  // USD * 1e6, so cost never drifts through repeated float arithmetic.
  totalTokens: integer("total_tokens").notNull().default(0),
  totalCostMicros: integer("total_cost_micros").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const spans = pgTable("spans", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  // Self-referential FK: the callback must be explicitly typed as
  // `AnyPgColumn` (not inferred from `spans.id`) or Drizzle hits a
  // temporal-dead-zone error trying to reference the table from inside
  // its own definition.
  parentSpanId: uuid("parent_span_id").references((): AnyPgColumn => spans.id, { onDelete: "cascade" }),
  type: spanTypeEnum("type").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  input: jsonb("input"),
  output: jsonb("output"),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  durationMs: integer("duration_ms"),
  // { inputTokens, outputTokens, cacheReadTokens?, cacheWriteTokens? } for
  // llm_call spans; null for tool_call spans.
  tokenUsage: jsonb("token_usage"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evalTasks = pgTable("eval_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  prompt: text("prompt").notNull(),
  hardAssertions: jsonb("hard_assertions").notNull().default([]),
  rubric: text("rubric").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evalResults = pgTable("eval_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  evalTaskId: uuid("eval_task_id")
    .notNull()
    .references(() => evalTasks.id, { onDelete: "cascade" }),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  hardAssertionsPassed: boolean("hard_assertions_passed").notNull(),
  judgeScore: integer("judge_score").notNull(),
  judgeRationale: text("judge_rationale").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---- relations ----

export const runsRelations = relations(runs, ({ many }) => ({
  spans: many(spans),
  evalResults: many(evalResults),
}));

export const spansRelations = relations(spans, ({ one, many }) => ({
  run: one(runs, { fields: [spans.runId], references: [runs.id] }),
  parent: one(spans, { fields: [spans.parentSpanId], references: [spans.id], relationName: "spanChildren" }),
  children: many(spans, { relationName: "spanChildren" }),
}));

export const evalTasksRelations = relations(evalTasks, ({ many }) => ({
  results: many(evalResults),
}));

export const evalResultsRelations = relations(evalResults, ({ one }) => ({
  evalTask: one(evalTasks, { fields: [evalResults.evalTaskId], references: [evalTasks.id] }),
  run: one(runs, { fields: [evalResults.runId], references: [runs.id] }),
}));

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type SpanRow = typeof spans.$inferSelect;
export type NewSpanRow = typeof spans.$inferInsert;
export type EvalTask = typeof evalTasks.$inferSelect;
export type NewEvalTask = typeof evalTasks.$inferInsert;
export type EvalResult = typeof evalResults.$inferSelect;
export type NewEvalResult = typeof evalResults.$inferInsert;
