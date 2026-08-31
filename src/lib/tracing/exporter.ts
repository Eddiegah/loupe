import type { SpanRecord } from "./types";

export interface RunEnvelope {
  id: string;
  task: string;
  label?: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  endedAt?: string;
}

export interface Exporter {
  /** Buffers a finished span; may trigger an async flush once the batch
   * size is reached. Does not itself guarantee delivery - call flush()
   * to force everything out. */
  addSpan(span: SpanRecord): void;
  /** Sends the current buffer plus the given run envelope, and waits for
   * the request to complete. startTrace() always calls this at both the
   * start (status: "running") and end (status: "completed"/"failed") of
   * a trace so a run is visible even if the process crashes mid-trace. */
  flush(run: RunEnvelope): Promise<void>;
}

export interface ExporterOptions {
  ingestUrl?: string;
  batchSize?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BATCH_SIZE = 5;

export function createExporter(opts: ExporterOptions = {}): Exporter {
  const ingestUrl = opts.ingestUrl ?? process.env.LOUPE_INGEST_URL ?? "http://localhost:3180/api/traces";
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const fetchImpl = opts.fetchImpl ?? fetch;

  let buffer: SpanRecord[] = [];
  let lastRun: RunEnvelope | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  async function send(run: RunEnvelope, spans: SpanRecord[]): Promise<void> {
    await fetchImpl(ingestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run, spans }),
    });
  }

  return {
    addSpan(span) {
      buffer.push(span);
      if (lastRun && buffer.length >= batchSize) {
        const toSend = buffer;
        buffer = [];
        const run = lastRun;
        // Chain onto the in-flight promise so batches for the same run
        // are always sent in order, without callers having to await
        // every addSpan() call.
        inFlight = inFlight.then(() => send(run, toSend));
      }
    },
    async flush(run) {
      lastRun = run;
      const toSend = buffer;
      buffer = [];
      const previous = inFlight;
      inFlight = previous.then(() => send(run, toSend));
      await inFlight;
    },
  };
}
