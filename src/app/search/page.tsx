import type { Metadata } from "next";
import Link from "next/link";

import { StudentCard } from "@/components/student/StudentCard";
import { ProjectCard } from "@/components/project/ProjectCard";
import { LinkButton } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Navigation";
import { EmptyState } from "@/components/ui/Panel";
import { Eyebrow, TechTag } from "@/components/ui/Tag";
import { PAGE_SIZE } from "@/lib/constants";
import { first, flattenParams } from "@/lib/data/filters";
import { listProjects } from "@/lib/data/projects";
import { searchTechnologies } from "@/lib/data/search";
import { listStudents } from "@/lib/data/students";

export const metadata: Metadata = {
  title: "Search",
  description: "Search projects, students and technologies across the archive.",
};

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const params = await searchParams;
  const q = first(params.q) ?? "";
  const rawPage = Number(first(params.page) ?? "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const [projects, students, technologies] = q
    ? await Promise.all([
        listProjects({ q, page, pageSize: PAGE_SIZE }),
        listStudents({ q, pageSize: 6 }),
        searchTechnologies(q, 12),
      ])
    : [null, null, null] as const;

  const total =
    (projects?.total ?? 0) + (students?.total ?? 0) + (technologies?.total ?? 0);

  return (
    <div className="w-full">
      <section className="border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <Eyebrow>Archive Search</Eyebrow>
          <h1 className="text-3xl font-bold tracking-tight text-gh-fg-default sm:text-4xl">
            {q ? `Results for “${q}”` : "Search the archive"}
          </h1>

          <form
            method="get"
            action="/search"
            className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <SearchInput
              name="q"
              aria-label="Search the archive"
              defaultValue={q}
              placeholder="Search projects, students, technologies…"
              className="flex-1"
            />
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-gh-border bg-gh-btn-bg px-4 text-sm font-medium text-gh-fg-default transition-colors hover:bg-gh-btn-hover"
            >
              <Icon name="search" size={16} />
              Search
            </button>
          </form>

          {q && (
            <p className="mt-4 text-sm text-gh-fg-muted">
              <span className="font-semibold text-gh-fg-default">{total}</span>{" "}
              {total === 1 ? "result" : "results"} across projects, students and
              stacks. Use the{" "}
              <Link
                href={`/explore?q=${encodeURIComponent(q)}`}
                className="text-gh-accent hover:underline"
              >
                filtered explore grid
              </Link>{" "}
              to narrow them down.
            </p>
          )}
        </div>
      </section>

      <section className="w-full">
        <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6">
          {!q && (
            <EmptyState
              icon="search"
              title="Start typing a project, a person or a stack"
              description="Search runs against the live database — titles, write-ups, student names and technology names."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <LinkButton href="/explore" variant="default">
                    Browse everything
                  </LinkButton>
                  <LinkButton href="/students" variant="ghost">
                    Student directory
                  </LinkButton>
                </div>
              }
            />
          )}

          {q && (
            <>
              {/* Projects */}
              <section aria-labelledby="search-projects">
                <div className="mb-5 flex items-end justify-between gap-4 border-b border-gh-border pb-3">
                  <div>
                    <h2
                      id="search-projects"
                      className="text-xl font-semibold text-gh-fg-default"
                    >
                      Projects
                    </h2>
                    <p className="font-mono text-xs text-gh-fg-muted">
                      {projects?.total ?? 0} matching
                    </p>
                  </div>
                  <Link
                    href={`/explore?q=${encodeURIComponent(q)}`}
                    className="text-xs font-semibold text-gh-accent hover:underline"
                  >
                    Open in explore
                  </Link>
                </div>

                {(projects?.items.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {projects?.items.map((project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="folder_special"
                    title="No projects matched"
                    description={`Nothing in the archive matches “${q}”. Try a technology name or a project title.`}
                    compact
                  />
                )}

                {projects && projects.pageCount > 1 && (
                  <Pagination
                    page={projects.page}
                    pageCount={projects.pageCount}
                    basePath="/search"
                    searchParams={flattenParams(params)}
                    className="mt-8"
                  />
                )}
              </section>

              {/* Students */}
              <section aria-labelledby="search-students">
                <div className="mb-5 flex items-end justify-between gap-4 border-b border-gh-border pb-3">
                  <div>
                    <h2
                      id="search-students"
                      className="text-xl font-semibold text-gh-fg-default"
                    >
                      Students
                    </h2>
                    <p className="font-mono text-xs text-gh-fg-muted">
                      {students?.total ?? 0} matching
                    </p>
                  </div>
                  <Link
                    href={`/students?q=${encodeURIComponent(q)}`}
                    className="text-xs font-semibold text-gh-accent hover:underline"
                  >
                    Search the directory
                  </Link>
                </div>

                {(students?.items.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {students?.items.map((student) => (
                      <StudentCard key={student.id} student={student} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="group"
                    title="No students matched"
                    description="Student search covers names, handles, headlines and bios."
                    compact
                  />
                )}
              </section>

              {/* Technologies */}
              {(technologies?.total ?? 0) > 0 && (
                <section aria-labelledby="search-tech">
                  <div className="mb-5 flex items-end justify-between gap-4 border-b border-gh-border pb-3">
                    <div>
                      <h2
                        id="search-tech"
                        className="text-xl font-semibold text-gh-fg-default"
                      >
                        Technologies
                      </h2>
                      <p className="font-mono text-xs text-gh-fg-muted">
                        {technologies?.total ?? 0} matching
                      </p>
                    </div>
                    <Link
                      href="/technologies"
                      className="text-xs font-semibold text-gh-accent hover:underline"
                    >
                      All stacks
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {technologies?.items.map((technology) => (
                      <span
                        key={technology.id}
                        className="inline-flex items-center gap-2 rounded-md border border-gh-border bg-gh-card px-3 py-2"
                      >
                        <TechTag
                          name={technology.name}
                          slug={technology.slug}
                          icon={technology.icon}
                          tone="accent"
                        />
                        <span className="font-mono text-[11px] text-gh-fg-muted">
                          {technology.projectCount}{" "}
                          {technology.projectCount === 1 ? "project" : "projects"}
                        </span>
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
