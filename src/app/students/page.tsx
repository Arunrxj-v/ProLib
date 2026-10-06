import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { StudentCard } from "@/components/student/StudentCard";
import { LinkButton } from "@/components/ui/Button";
import { Field, SearchInput, Select } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Navigation";
import { EmptyState, Skeleton } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Tag";
import { flattenParams, first, withoutKey } from "@/lib/data/filters";
import { listStudents } from "@/lib/data/students";
import { getDepartments } from "@/lib/data/taxonomy";

export const metadata: Metadata = {
  title: "Student directory",
  description:
    "Every verified student builder on campus, with their department, batch, skills and published projects.",
};

type ResultsProps = {
  q?: string;
  department?: string;
  page: number;
  params: Record<string, string | string[] | undefined>;
  hasFilters: boolean;
};

/**
 * Results stream in behind a Suspense boundary *inside* the page rather than
 * through a `loading.tsx` route file: a segment-level loading boundary would
 * commit the response before `/students/[username]` can answer with a 404 for
 * unknown handles.
 */
async function StudentResults({
  q,
  department,
  page,
  params,
  hasFilters,
}: ResultsProps) {
  const result = await listStudents({ q, department, page });

  return (
    <>
      <section className="border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gh-fg-muted">
              <span className="font-semibold text-gh-fg-default">
                {result.total}
              </span>{" "}
              {result.total === 1 ? "builder" : "builders"}
              {q && (
                <>
                  {" "}
                  matching{" "}
                  <span className="font-mono text-gh-accent">“{q}”</span>
                </>
              )}
            </p>

            {hasFilters && (
              <Link
                href={withoutKey(params, "q", "/students")}
                className="text-xs font-medium text-gh-fg-muted hover:text-gh-accent"
              >
                Clear search
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="w-full">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {result.items.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {result.items.map((student) => (
                <StudentCard key={student.id} student={student} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="group"
              title={
                hasFilters
                  ? "No students match that search"
                  : "No student profiles yet"
              }
              description={
                hasFilters
                  ? "Try a different name, handle or department."
                  : "Create your profile to appear in the directory."
              }
              action={
                hasFilters ? (
                  <LinkButton
                    href="/students"
                    variant="default"
                    leadingIcon="filter_list"
                  >
                    Clear search
                  </LinkButton>
                ) : (
                  <LinkButton
                    href="/signup"
                    variant="primary"
                    leadingIcon="person_add"
                  >
                    Create your profile
                  </LinkButton>
                )
              }
            />
          )}

          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            basePath="/students"
            searchParams={flattenParams(params)}
            className="mt-8"
          />
        </div>
      </section>
    </>
  );
}

function StudentResultsSkeleton({ hasFilters }: { hasFilters: boolean }) {
  return (
    <>
      <section className="border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            {hasFilters && <Skeleton className="h-3 w-24" />}
          </div>
        </div>
      </section>

      <section className="w-full">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-gh-border bg-gh-card p-6"
              >
                <div className="mb-4 flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <div className="mt-5 flex gap-1.5">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default async function StudentsPage({
  searchParams,
}: PageProps<"/students">) {
  const params = await searchParams;
  const q = first(params.q);
  const department = first(params.department);
  const rawPage = Number(first(params.page) ?? "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const departments = await getDepartments();
  const hasFilters = Boolean(q || department);

  return (
    <div className="w-full">
      <section className="border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <Eyebrow>Peer Network</Eyebrow>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gh-fg-default sm:text-4xl">
                Student builders
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gh-fg-muted">
                Profiles are created by the students themselves. A profile only
                shows links the student actually connected — nothing is filled
                in with placeholders.
              </p>
            </div>
            <LinkButton
              href="/signup"
              variant="default"
              leadingIcon="person_add"
            >
              Create your profile
            </LinkButton>
          </div>

          <form
            method="get"
            action="/students"
            className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <Field
              label="Search by name, handle or skill"
              htmlFor="students-q"
              className="flex-1"
            >
              <SearchInput
                id="students-q"
                name="q"
                aria-label="Search students"
                defaultValue={q ?? ""}
                placeholder="e.g. Arunraj, firmware, PyTorch…"
              />
            </Field>

            <Field
              label="Department"
              htmlFor="students-department"
              className="sm:w-64"
            >
              <Select
                id="students-department"
                name="department"
                defaultValue={department ?? ""}
              >
                <option value="">All departments</option>
                {departments.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>

            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-gh-border bg-gh-btn-bg px-4 text-sm font-medium text-gh-fg-default transition-colors hover:bg-gh-btn-hover"
            >
              <Icon name="search" size={16} />
              Search
            </button>
          </form>
        </div>
      </section>

      <Suspense
        key={`${q ?? ""}|${department ?? ""}|${page}`}
        fallback={<StudentResultsSkeleton hasFilters={hasFilters} />}
      >
        <StudentResults
          q={q}
          department={department}
          page={page}
          params={params}
          hasFilters={hasFilters}
        />
      </Suspense>
    </div>
  );
}
