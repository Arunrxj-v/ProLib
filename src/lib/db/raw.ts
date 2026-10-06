import type { SQL } from "drizzle-orm";

import { db } from "./index";

/**
 * Awaits a raw `sql` statement and returns its rows as a plain array.
 * postgres-js answers with a RowList (array-like); this normalises the cast
 * at one place instead of sprinkling `as` through the query layer.
 */
export async function rawRows<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result as unknown as T[];
}
