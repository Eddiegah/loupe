import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

// A single shared connection pool per process - Next.js can otherwise
// create a fresh pool per hot-reload in dev, which quietly exhausts
// Postgres's connection limit.
const globalForDb = globalThis as unknown as { loupeSql?: ReturnType<typeof postgres> };
export const sql = globalForDb.loupeSql ?? postgres(databaseUrl, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.loupeSql = sql;

export const db = drizzle(sql, { schema });
