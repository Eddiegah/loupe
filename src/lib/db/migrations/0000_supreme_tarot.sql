CREATE TYPE "public"."run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."span_type" AS ENUM('llm_call', 'tool_call');--> statement-breakpoint
CREATE TABLE "eval_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eval_task_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"hard_assertions_passed" boolean NOT NULL,
	"judge_score" integer NOT NULL,
	"judge_rationale" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"prompt" text NOT NULL,
	"hard_assertions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rubric" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task" varchar(300) NOT NULL,
	"label" varchar(120),
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"total_cost_micros" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"parent_span_id" uuid,
	"type" "span_type" NOT NULL,
	"name" varchar(200) NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"duration_ms" integer,
	"token_usage" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_eval_task_id_eval_tasks_id_fk" FOREIGN KEY ("eval_task_id") REFERENCES "public"."eval_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spans" ADD CONSTRAINT "spans_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spans" ADD CONSTRAINT "spans_parent_span_id_spans_id_fk" FOREIGN KEY ("parent_span_id") REFERENCES "public"."spans"("id") ON DELETE cascade ON UPDATE no action;