import type { Metadata } from "next";
import Link from "next/link";

import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Tag";
import { getCategories, getDepartments } from "@/lib/data/taxonomy";
import { cn, compactNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Project categories",
  description:
    "Browse the campus archive by project category and by department.",
};

const TONE_CLASS: Record<string, string> = {
  accent: "text-gh-accent",
  success: "text-gh-success",
  attention: "text-gh-attention",
  danger: "text-gh-danger",
  done: "text-gh-done",
};

export default async function CategoriesPage() {
  const [categories, departments] = await Promise.all([
    getCategories(),
    getDepartments(),
  ]);

  return (
    <div className="w-full">
      <section className="border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <Eyebrow>Architecture Taxonomies</Eyebrow>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gh-fg-default sm:text-4xl">
                Explore by category
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gh-fg-muted">
                Categories are editable by administrators — nothing here is
                hardcoded. Counts reflect what is actually published in the
                archive right now.
              </p>
            </div>
            <LinkButton href="/explore" variant="default" leadingIcon="grid_view">
              Open the full grid
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="w-full border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          {categories.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/explore?category=${category.slug}`}
                  className="group flex items-start justify-between gap-4 rounded-lg border border-gh-border bg-gh-card p-6 transition-all hover:border-gh-fg-subtle"
                >
                  <div className="space-y-2">
                    <span
                      className={cn(
                        "inline-flex h-10 w-10 items-center justify-center rounded-md border border-gh-border bg-gh-inset",
                        TONE_CLASS[category.tone] ?? "text-gh-accent",
                      )}
                    >
                      <Icon name={category.icon ?? "label"} size={20} />
                    </span>
                    <h2 className="text-base font-semibold text-gh-fg-default transition-colors group-hover:text-gh-accent">
                      {category.name}
                    </h2>
                    <p className="text-xs leading-relaxed text-gh-fg-muted">
                      {category.description ?? "Student projects in this category."}
                    </p>
                    <p
                      className={cn(
                        "pt-2 font-mono text-xs font-medium",
                        TONE_CLASS[category.tone] ?? "text-gh-accent",
                      )}
                    >
                      {compactNumber(category.projectCount)}{" "}
                      {category.projectCount === 1 ? "project" : "projects"} documented
                    </p>
                  </div>
                  <Icon
                    name="chevron_right"
                    size={20}
                    className="mt-1 shrink-0 text-gh-fg-subtle transition-all group-hover:translate-x-1 group-hover:text-gh-fg-default"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="category"
              title="No categories yet"
              description="An administrator can add categories from the admin console."
              action={
                <LinkButton href="/admin/taxonomy" variant="default">
                  Manage taxonomy
                </LinkButton>
              }
            />
          )}
        </div>
      </section>

      <section className="w-full">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <Eyebrow>Department Index</Eyebrow>
          <h2 className="mb-6 text-2xl font-semibold text-gh-fg-default">
            Browse by department
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {departments.map((department) => (
              <Link
                key={department.id}
                href={`/explore?department=${department.slug}`}
                className="group rounded-lg border border-gh-border bg-gh-card p-4 transition-all hover:border-gh-fg-subtle"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold tracking-wider text-gh-accent">
                    {department.code ?? "DEPT"}
                  </span>
                  <span className="font-mono text-xs text-gh-fg-muted">
                    {department.projectCount}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-medium text-gh-fg-default transition-colors group-hover:text-gh-accent">
                  {department.name}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gh-fg-muted">
                  {department.description ?? "Capstones, labs and coursework."}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
