import type { Metadata } from "next";
import Link from "next/link";

import {
  ActiveFilterChips,
  ExploreFilters,
  SortLinks,
} from "@/components/discover/Filters";
import { ProjectCard } from "@/components/project/ProjectCard";
import { Button, LinkButton } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Navigation";
import { EmptyState } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Tag";
import { withBase } from "@/lib/base-path";
import { SITE } from "@/lib/constants";
import { flattenParams, parseProjectQuery } from "@/lib/data/filters";
import { listProjects } from "@/lib/data/projects";
import {
  getAcademicYears,
  getCategories,
  getDepartments,
  getTechnologies,
} from "@/lib/data/taxonomy";

export const metadata: Metadata = {
  title: "Explore the library",
  description:
    "Filter and search every documented student project by department, category, technology, academic year and stage.",
};

export default async function ExplorePage({
  searchParams,
}: PageProps<"/explore">) {
  const params = await searchParams;
  const query = parseProjectQuery(params);

  const [result, departments, categories, technologies, years] =
    await Promise.all([
      listProjects(query),
      getDepartments(),
      getCategories(),
      getTechnologies(),
      getAcademicYears(),
    ]);

  const flatParams = flattenParams(params);
  const hasResults = result.items.length > 0;

  /**
   * No search term and no filters means the reader is simply browsing a
   * brand-new archive — that is an empty library ("be the first"), not a
   * filter combination that failed to match anything.
   */
  const isBareBrowse =
    !query.q &&
    !query.department &&
    !query.category &&
    !query.type &&
    !query.status &&
    !query.technology &&
    !query.year &&
    !query.openSource;

  return (
    <div className="w-full">
      <section className="border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <Eyebrow>Archive Feed</Eyebrow>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gh-fg-default sm:text-4xl">
                Explore the library
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gh-fg-muted">
                Search every documented project by department, category,
                technology and stage. Filters are links, so a view is always
                shareable.
              </p>
            </div>

            <LinkButton
              href="/dashboard/projects/new"
              variant="primary"
              leadingIcon="add_circle"
            >
              Submit a project
            </LinkButton>
          </div>

          {/* One GET form owns search + filters: works with JavaScript off. */}
          <form method="get" action={withBase("/explore")} className="mt-7">
            {/* A search submit must not silently drop an active sort. */}
            {query.sort && (
              <input type="hidden" name="sort" value={query.sort} />
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                name="q"
                aria-label="Search projects"
                defaultValue={query.q ?? ""}
                placeholder="Search projects, technologies, keywords…"
                className="flex-1"
              />
              <Button type="submit" variant="default" leadingIcon="search">
                Search
              </Button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[268px_minmax(0,1fr)]">
              <ExploreFilters
                query={query}
                options={{ departments, categories, technologies, years }}
              />

              <div className="min-w-0 space-y-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-gh-fg-muted">
                    <span className="font-semibold text-gh-fg-default">
                      {result.total}
                    </span>{" "}
                    {result.total === 1 ? "project" : "projects"}
                    {query.q && (
                      <>
                        {" "}
                        matching{" "}
                        <span className="font-mono text-gh-accent">
                          “{query.q}”
                        </span>
                      </>
                    )}
                  </p>
                  <SortLinks query={query} params={params} />
                </div>

                <ActiveFilterChips query={query} params={params} />

                {hasResults ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {result.items.map((project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={isBareBrowse ? "folder_special" : "search_off"}
                    title={
                      isBareBrowse ? "No projects yet" : "No projects match these filters"
                    }
                    description={
                      isBareBrowse
                        ? "Be the first to add your project."
                        : query.q
                          ? `Nothing in the archive matches “${query.q}” with the current filters. Try a broader term or clear the filters.`
                          : "No projects match this combination yet. Widen the filters to see more of the archive."
                    }
                    action={
                      isBareBrowse ? (
                        <LinkButton
                          href="/dashboard/projects/new"
                          variant="primary"
                          leadingIcon="add"
                        >
                          Add a project
                        </LinkButton>
                      ) : (
                        <LinkButton
                          href="/explore"
                          variant="default"
                          leadingIcon="filter_list"
                        >
                          Clear all filters
                        </LinkButton>
                      )
                    }
                  />
                )}

                <Pagination
                  page={result.page}
                  pageCount={result.pageCount}
                  basePath="/explore"
                  searchParams={flatParams}
                />

                <p className="flex items-center gap-1.5 pt-2 font-mono text-xs text-gh-fg-subtle">
                  <Icon name="database" size={14} />
                  Page {result.page} of {result.pageCount} · {SITE.name} archive
                </p>
              </div>
            </div>
          </form>
        </div>
      </section>

      <section className="w-full">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-gh-fg-muted">
            Looking for a person instead? The builder directory lists every
            verified student profile.
          </p>
          <Link
            href="/students"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gh-accent hover:underline"
          >
            Open the student directory
            <Icon name="arrow_forward" size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
