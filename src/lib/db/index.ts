import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

/**
 * PostgreSQL connection.
 *
 * Local default matches docker-compose.yml (`db` service). Override with
 * DATABASE_URL when the stack moves to the home server. Migrations are an
 * explicit step — `npm run db:migrate` — never hidden inside app boot.
 */
const DEFAULT_URL = "postgres://prolib:prolib@127.0.0.1:5432/prolib";

export const DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_URL;

function openDatabase(): Db {
  const client = postgres(DATABASE_URL, {
    max: 10,
    // Fail fast instead of hanging a page render on a database that is not
    // reachable; every caller surfaces an honest error state.
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}

/**
 * The connection survives `next dev` module reloads by hiding on globalThis.
 * Falls back to a fresh connection when running outside Next (scripts/tests).
 */
function resolveDb(): Db {
  const store = globalThis as typeof globalThis & { __prolibDb?: Db };
  if (store.__prolibDb) return store.__prolibDb;

  const db = openDatabase();
  store.__prolibDb = db;
  return db;
}

export const db = resolveDb();

/** Closes the underlying pool — used by one-shot scripts so they can exit. */
export async function closeConnection(): Promise<void> {
  const client = (db as unknown as { $client?: { end: (options?: object) => Promise<void> } }).$client;
  if (client?.end) await client.end({ timeout: 5 });
}

export { schema };
