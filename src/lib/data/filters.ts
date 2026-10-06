import { PAGE_SIZE, PROJECT_SORTS, type ProjectSort } from "@/lib/constants";

import type { ProjectQuery } from "./projects";

/** First non-empty value of a repeated query parameter. */
export function first(
  value: string | string[] | undefined,
): string | undefined {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (typeof resolved !== "string") return undefined;
  const trimmed = resolved.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isSort(value: string | undefined): value is ProjectSort {
  return PROJECT_SORTS.some((sort) => sort.value === value);
}

/**
 * Turns raw `searchParams` into the query the data layer understands.
 * Unknown values are dropped rather than passed through to SQL.
 */
export function parseProjectQuery(
  params: Record<string, string | string[] | undefined>,
): ProjectQuery {
  const page = Number(first(params.page) ?? "1");
  const sort = first(params.sort);

  return {
    q: first(params.q),
    department: first(params.department),
    category: first(params.category),
    type: first(params.type),
    status: first(params.status),
    technology: first(params.technology),
    year: first(params.year),
    openSource: first(params.openSource) === "1",
    sort: isSort(sort) ? sort : undefined,
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    pageSize: PAGE_SIZE,
  };
}

/** Query keys a filter control owns — used to build "clear this" links. */
export const FILTER_KEYS = [
  "q",
  "department",
  "category",
  "type",
  "status",
  "technology",
  "year",
  "openSource",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

/** Drops one key (and the page number) so pagination restarts at page 1. */
export function withoutKey(
  params: Record<string, string | string[] | undefined>,
  key: string,
  basePath: string,
): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    const resolved = Array.isArray(value) ? value[0] : value;
    if (!resolved || name === key || name === "page") continue;
    search.set(name, resolved);
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** `?a=1&a=2` arrives as an array; link builders only need the first value. */
export function flattenParams(
  params: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}
