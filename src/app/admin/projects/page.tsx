import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button, LinkButton } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Pagination, TabLinks } from "@/components/ui/Navigation";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Tag";
import { withBase } from "@/lib/base-path";
import { PUBLICATION_STATUSES, type ProjectPublicationStatus } from "@/lib/constants";
import { requireAdmin } from "@/lib/auth/guards";
import {
  listAdminProjects,
  statusLabel,
  statusTone,
} from "@/lib/data/admin";
import { first, flattenParams } from "@/lib/data/filters";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Review queue",
  description: "Search, filter and moderate every student project submission.",
};

const TONE_BADGE: Record<
  string,
  "accent" | "success" | "attention" | "danger" | "muted"
> = {
  accent: "accent",
  success: "success",
  attention: "attention",
  danger: "danger",
  muted: "muted",
};

function isStatus(value: string | undefined): value is ProjectPublicationStatus {
  return PUBLICATION_STATUSES.some((item) => item.value === value);
}

export default async function AdminProjectsPage({
  searchParams,
}: PageProps<"/admin/projects">) {
  await requireAdmin();

  const params = await searchParams;
  const rawStatus = first(params.status);
  const status = rawStatus === "all" || isStatus(rawStatus) ? rawStatus : undefined;
  const q = first(params.q);
  const page = Number(first(params.page) ?? "1");

  const result = await listAdminProjects({
    status: status as ProjectPublicationStatus | "all" | undefined,
    q,
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    pageSize: 12,
  });

  const flat = flattenParams(params);

  const tabHref = (value: string): string => {
    const search = new URLSearchParams();
    if (value !== "all") search.set("status", value);
    if (q) search.set("q", q);
    const query = search.toString();
    return query ? `/admin/projects?${query}` : "/admin/projects";
  };

  const tabs = [
    { value: "all", label: "All", href: tabHref("all") },
    ...PUBLICATION_STATUSES.map((item) => ({
      value: item.value,
      label: item.label,
      href: tabHref(item.value),
    })),
  ];
  const activeTab = status ?? "all";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Moderation"
        title="Review queue"
        description="Every project in the archive, newest submission first. Open a row to read the write-up and make a decision."
        action={
          <LinkButton href="/admin" variant="ghost" leadingIcon="arrow_back">
            Overview
          </LinkButton>
        }
      />

      <div className="space-y-4">
        <form method="get" action={withBase("/admin/projects")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              name="q"
              aria-label="Search projects by title"
              defaultValue={q ?? ""}
              placeholder="Search by title, slug or description…"
              className="sm:max-w-md flex-1"
            />
            <Button type="submit" variant="default" leadingIcon="search">
              Search
            </Button>
            {q && (
              <Link
                href={tabHref(activeTab)}
                className="text-xs font-medium text-gh-fg-muted hover:text-gh-accent"
              >
                Clear search
              </Link>
            )}
            {status && <input type="hidden" name="status" value={status} />}
          </div>
        </form>

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabLinks
            tabs={tabs}
            active={activeTab}
            label="Filter by publication status"
          />
        </div>
      </div>

      <p className="text-sm text-gh-fg-muted">
        <span className="font-semibold text-gh-fg-default">{result.total}</span>{" "}
        {result.total === 1 ? "project" : "projects"}
        {status && <> with status {statusLabel(status)}</>}
        {q && (
          <>
            {" "}
            matching <span className="font-mono text-gh-accent">“{q}”</span>
          </>
        )}
      </p>

      {result.items.length > 0 ? (
        <ul className="space-y-3">
          {result.items.map((project) => (
            <li key={project.id}>
              <article className="rounded-lg border border-gh-border bg-gh-card p-4 transition-colors hover:border-gh-fg-subtle sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TONE_BADGE[statusTone(project.publicationStatus)] ?? "muted"} dot>
                        {statusLabel(project.publicationStatus)}
                      </Badge>
                      {project.featured && <Badge tone="attention">Featured</Badge>}
                      {project.openReportCount > 0 && (
                        <Badge tone="danger">
                          {project.openReportCount} open report
                          {project.openReportCount === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>

                    <h2 className="mt-2 text-base font-semibold text-gh-fg-default">
                      <Link
                        href={`/admin/projects/${project.id}`}
                        className="hover:text-gh-accent"
                      >
                        {project.title}
                      </Link>
                    </h2>
                    <p className="mt-0.5 font-mono text-[11px] text-gh-fg-subtle">
                      /projects/{project.slug}
                    </p>
                    <p className="clamp-2 mt-1.5 text-sm leading-relaxed text-gh-fg-muted">
                      {project.shortDescription}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-gh-fg-muted">
                      <span className="flex items-center gap-1.5">
                        <Icon name="person" size={13} />
                        {project.owner?.name ?? "Unknown"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Icon name="corporate_fare" size={13} />
                        {project.department?.name ?? "No department"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Icon name="schedule" size={13} />
                        {project.submittedAt
                          ? `Submitted ${relativeTime(project.submittedAt)}`
                          : `Created ${relativeTime(project.createdAt)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <LinkButton
                      href={`/projects/${project.slug}`}
                      variant="ghost"
                      size="sm"
                      leadingIcon="open_in_new"
                    >
                      Public page
                    </LinkButton>
                    <LinkButton
                      href={`/admin/projects/${project.id}`}
                      variant="primary"
                      size="sm"
                      trailingIcon="arrow_forward"
                    >
                      Review
                    </LinkButton>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="search_off"
          title="No projects match"
          description={
            q
              ? `Nothing in the queue matches “${q}”. Try a shorter search or clear the status filter.`
              : "No project currently has this status."
          }
          action={
            <LinkButton href="/admin/projects" variant="default">
              Show the whole queue
            </LinkButton>
          }
        />
      )}

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        basePath="/admin/projects"
        searchParams={flat}
      />

      <Panel padded={false}>
        <PanelHeader
          title="How the queue works"
          description="The workflow every submission follows"
        />
        <ol className="divide-y divide-gh-border-muted text-sm text-gh-fg-muted">
          {[
            "Draft → Submitted: the team hands the project in from their dashboard.",
            "Submitted → In review: an administrator picks it up.",
            "In review → Approved or Rejected: rejection must include a reason the team can act on.",
            "Approved → Published: it appears in the public library (immediate while moderation is off).",
          ].map((step, index) => (
            <li key={step} className="flex gap-3 px-4 py-3">
              <span className="font-mono text-xs text-gh-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
