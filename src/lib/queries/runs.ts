import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runs, spans, type Run, type SpanRow } from "@/lib/db/schema";

export interface SpanNode extends SpanRow {
  children: SpanNode[];
}

export async function listRuns(limit = 50): Promise<Run[]> {
  return db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit);
}

export async function getRun(runId: string): Promise<Run | undefined> {
  const rows = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  return rows[0];
}

export async function getRunSpans(runId: string): Promise<SpanRow[]> {
  return db.select().from(spans).where(eq(spans.runId, runId)).orderBy(spans.startedAt);
}

/** Assembles a flat span list into a parent/child tree via parentSpanId,
 * preserving each span's startedAt order among its siblings. */
export function buildSpanTree(flat: SpanRow[]): SpanNode[] {
  const byId = new Map<string, SpanNode>();
  for (const s of flat) byId.set(s.id, { ...s, children: [] });

  const roots: SpanNode[] = [];
  for (const s of flat) {
    const node = byId.get(s.id)!;
    if (s.parentSpanId && byId.has(s.parentSpanId)) {
      byId.get(s.parentSpanId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
