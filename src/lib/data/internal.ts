import { sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { toLikePattern, toTsPrefixQuery } from "@/lib/db/search-index";

/**
 * Full-text search uses the generated `search_document` tsvector columns.
 * We probe for them once per process so a database that has not been
 * migrated yet (or a role without catalogue access) degrades to LIKE-based
 * search instead of failing every listing page.
 */
let searchState: boolean | null = null;

async function hasSearchIndex(): Promise<boolean> {
  if (searchState !== null) return searchState;
  try {
    const rows = await db.execute<{ exists: boolean | null }>(
      sql`SELECT to_regclass('public.projects_search_document_idx') IS NOT NULL AS exists`,
    );
    const row = (rows as unknown as Array<{ exists: boolean | null }>)[0];
    searchState = Boolean(row?.exists);
  } catch {
    searchState = false;
  }
  return searchState;
}

function likePredicate(columns: SQL[], query: string): SQL {
  const pattern = toLikePattern(query);
  const parts = columns.map(
    (column) => sql`(${column} LIKE ${pattern} ESCAPE '\\')`,
  );
  return sql.join(parts, sql` OR `);
}

/**
 * Full-text match over the project document (title, summary, description),
 * combined with an explicit column list for the LIKE fallback.
 * Returns undefined when there is nothing to search for.
 */
export async function projectTextMatch(
  query: string | undefined,
  likeColumns: SQL[],
): Promise<SQL | undefined> {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;

  if (await hasSearchIndex()) {
    const match = toTsPrefixQuery(trimmed);
    if (!match) return undefined;
    return sql`projects.search_document @@ to_tsquery('english', ${match})`;
  }

  return likePredicate(likeColumns, trimmed);
}

/** Full-text match over the student document (name, username, headline, bio). */
export async function userTextMatch(
  query: string | undefined,
  likeColumns: SQL[],
): Promise<SQL | undefined> {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;

  if (await hasSearchIndex()) {
    const match = toTsPrefixQuery(trimmed);
    if (!match) return undefined;
    return sql`users.search_document @@ to_tsquery('english', ${match})`;
  }

  return likePredicate(likeColumns, trimmed);
}

/** Simple LIKE match for small lookup tables (technologies, departments…). */
export function likeMatch(columns: SQL[], query: string | undefined): SQL | undefined {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  return likePredicate(columns, trimmed);
}
