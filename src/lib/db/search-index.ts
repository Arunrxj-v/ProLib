/**
 * Document-search helpers for PostgreSQL.
 *
 * Full text lives in generated `search_document` tsvector columns on
 * `projects` and `users` (created by `drizzle/0001_search.sql`), kept fresh
 * automatically on every insert/update — no triggers to desynchronise.
 * These helpers only build the query text handed to Postgres.
 */

/**
 * Build a prefix `tsquery` from raw user input, e.g.
 * `'flut':* & 'flutter':*`.
 *
 * Every token is quoted (so operators such as `&`, `|`, `!` in a search
 * string are inert instead of raising a parse error) and prefix-matched,
 * mirroring the old FTS5 `"token"*` behaviour. Returns null when there is
 * nothing searchable.
 */
export function toTsPrefixQuery(input: string): string | null {
  const tokens = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map((token) => token.replace(/'/g, ""))
    .filter((token) => token.length > 0);

  if (tokens.length === 0) return null;
  return tokens.map((token) => `'${token}':*`).join(" & ");
}

/** Escape a value for a LIKE pattern with the default escape character. */
export function toLikePattern(input: string): string {
  return `%${input.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
