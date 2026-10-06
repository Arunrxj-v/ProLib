import Link from "next/link";

import { Button, LinkButton } from "@/components/ui/Button";
import { Checkbox, Field, Select } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Tag";
import { LIFECYCLE_STATUSES, PROJECT_TYPES } from "@/lib/constants";
import type { ProjectQuery } from "@/lib/data/projects";
import { withoutKey } from "@/lib/data/filters";
import type { CategoryOption, DepartmentOption, TechnologyOption } from "@/lib/data/taxonomy";
import { cn } from "@/lib/utils";

export type FilterOptions = {
  departments: DepartmentOption[];
  categories: CategoryOption[];
  technologies: TechnologyOption[];
  years: Array<{ label: string; slug: string }>;
};

const OPEN_KEYS = [
  "q",
  "department",
  "category",
  "type",
  "status",
  "technology",
  "year",
  "openSource",
] as const;

function activeFilterCount(query: ProjectQuery) {
  return OPEN_KEYS.filter((key) => Boolean(query[key])).length;
}

/* ------------------------------------------------------------------ */
/* Filter sidebar — a plain GET form, so it works without JavaScript    */
/* ------------------------------------------------------------------ */

export function ExploreFilters({
  query,
  options,
  className,
}: {
  query: ProjectQuery;
  options: FilterOptions;
  className?: string;
}) {
  const count = activeFilterCount(query);

  return (
    <aside
      aria-label="Project filters"
      className={cn("self-start lg:sticky lg:top-24", className)}
    >
      <div className="rounded-lg border border-gh-border bg-gh-card">
        <div className="flex items-center justify-between gap-2 border-b border-gh-border bg-gh-subtle px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gh-fg-default">
            <Icon name="tune" size={16} tone="accent" />
            Filters
            {count > 0 && (
              <Badge tone="accent" className="ml-1">
                {count}
              </Badge>
            )}
          </h2>
          <Link
            href="/explore"
            className="text-xs font-medium text-gh-fg-muted hover:text-gh-accent"
          >
            Reset
          </Link>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-1">
          <Field label="Department" htmlFor="filter-department">
            <Select
              id="filter-department"
              name="department"
              defaultValue={query.department ?? ""}
            >
              <option value="">All departments</option>
              {options.departments.map((department) => (
                <option key={department.id} value={department.slug}>
                  {department.name} ({department.projectCount})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category" htmlFor="filter-category">
            <Select
              id="filter-category"
              name="category"
              defaultValue={query.category ?? ""}
            >
              <option value="">All categories</option>
              {options.categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name} ({category.projectCount})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Technology" htmlFor="filter-technology">
            <Select
              id="filter-technology"
              name="technology"
              defaultValue={query.technology ?? ""}
            >
              <option value="">All technologies</option>
              {options.technologies.map((technology) => (
                <option key={technology.id} value={technology.slug}>
                  {technology.name} ({technology.projectCount})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Project type" htmlFor="filter-type">
            <Select
              id="filter-type"
              name="type"
              defaultValue={query.type ?? ""}
            >
              <option value="">Any type</option>
              {PROJECT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Stage" htmlFor="filter-status">
            <Select
              id="filter-status"
              name="status"
              defaultValue={query.status ?? ""}
            >
              <option value="">Any stage</option>
              {LIFECYCLE_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Academic year" htmlFor="filter-year">
            <Select
              id="filter-year"
              name="year"
              defaultValue={query.year ?? ""}
            >
              <option value="">Any year</option>
              {options.years.map((year) => (
                <option key={year.slug} value={year.slug}>
                  {year.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-2 lg:col-span-1">
            <Checkbox
              name="openSource"
              value="1"
              defaultChecked={Boolean(query.openSource)}
              label="Publishes a repository"
              description="Only projects with a source link"
            />
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <Button type="submit" variant="primary" block leadingIcon="filter_list">
              Apply filters
            </Button>
            <LinkButton href="/explore" variant="ghost" block>
              Clear all
            </LinkButton>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Active filter chips (each one removes just itself)                   */
/* ------------------------------------------------------------------ */

const CHIP_LABELS: Record<string, string> = {
  q: "Search",
  department: "Department",
  category: "Category",
  type: "Type",
  status: "Stage",
  technology: "Technology",
  year: "Year",
  openSource: "Repository",
};

const CHIP_VALUES: Record<string, (query: ProjectQuery) => string | null> = {
  q: (query) => query.q ?? null,
  department: (query) => query.department ?? null,
  category: (query) => query.category ?? null,
  type: (query) => query.type ?? null,
  status: (query) => query.status ?? null,
  technology: (query) => query.technology ?? null,
  year: (query) => query.year ?? null,
  openSource: (query) => (query.openSource ? "Has repository" : null),
};

export function ActiveFilterChips({
  query,
  params,
  basePath = "/explore",
}: {
  query: ProjectQuery;
  params: Record<string, string | string[] | undefined>;
  basePath?: string;
}) {
  const chips = OPEN_KEYS.flatMap((key) => {
    const value = CHIP_VALUES[key](query);
    return value ? [{ key, value }] : [];
  });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs text-gh-fg-muted">Active filter:</span>
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={withoutKey(params, chip.key, basePath)}
          className="group inline-flex items-center gap-1 rounded-md border border-[rgba(56,139,253,0.35)] bg-[rgba(56,139,253,0.1)] px-2.5 py-1 font-mono text-xs text-gh-accent transition-colors hover:border-gh-accent"
          title={`Remove ${CHIP_LABELS[chip.key]} filter`}
        >
          <span className="text-gh-fg-subtle group-hover:text-gh-accent">
            {CHIP_LABELS[chip.key]}:
          </span>
          <span className="max-w-40 truncate">{chip.value}</span>
          <Icon name="close" size={14} className="text-gh-fg-subtle group-hover:text-gh-accent" />
        </Link>
      ))}
      <Link
        href={basePath}
        className="text-xs font-medium text-gh-fg-muted hover:text-gh-accent"
      >
        Clear all
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sort links — state lives in the URL                                  */
/* ------------------------------------------------------------------ */

const SORT_LABELS: Array<{ value: string; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "trending", label: "Trending" },
  { value: "popular", label: "Most liked" },
  { value: "views", label: "Most viewed" },
];

export function SortLinks({
  query,
  params,
}: {
  query: ProjectQuery;
  params: Record<string, string | string[] | undefined>;
}) {
  const active = query.sort ?? "newest";

  const hrefFor = (value: string) => {
    const search = new URLSearchParams();
    for (const [name, raw] of Object.entries(params)) {
      const resolved = Array.isArray(raw) ? raw[0] : raw;
      if (resolved && name !== "page" && name !== "sort") search.set(name, resolved);
    }
    if (value !== "newest") search.set("sort", value);
    const qs = search.toString();
    return qs ? `?${qs}` : "";
  };

  return (
    <nav
      aria-label="Sort projects"
      className="flex flex-wrap items-center gap-1.5 rounded-md border border-gh-border bg-gh-inset p-1"
    >
      {SORT_LABELS.map((sort) => {
        const isActive = sort.value === active;
        return (
          <Link
            key={sort.value}
            href={hrefFor(sort.value)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "rounded px-2.5 py-1.5 text-xs transition-colors",
              isActive
                ? "border border-gh-border bg-gh-btn-bg font-medium text-gh-fg-default"
                : "border border-transparent text-gh-fg-muted hover:text-gh-fg-default",
            )}
          >
            {sort.label}
          </Link>
        );
      })}
    </nav>
  );
}
