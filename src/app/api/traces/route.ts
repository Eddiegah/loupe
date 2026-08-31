import { NextResponse } from "next/server";
import { ingestTrace, type IngestPayload } from "@/lib/ingestion/ingestTrace";

export async function POST(request: Request) {
  const body = (await request.json()) as IngestPayload;
  const result = await ingestTrace(body);
  return NextResponse.json(result, { status: 201 });
}
