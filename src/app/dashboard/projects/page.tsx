import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ProjectActions } from "@/components/dashboard/ProjectActions";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Navigation";
import { Alert, EmptyState } from "@/components/ui/Panel";
import { Badge, Eyebrow } from "@/components/ui/Tag";
import { TabLinks } from "@/components/ui/Navigation";
import { PUBLICATION_STATUSES, type ProjectPublicationStatus } from "@/lib/constants";
import { requireUser } from "@/lib/auth/guards";
import { withBase } from "@/lib/base-path";
import { countMyProjects, listMyProjects } from "@/lib/data/myProjects";
import { isModerationEnabled } from "@/lib/settings";
import { flattenParams, first } from "@/lib/data/filters";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My projects",
  description: "Drafts, submissions and published work you own.",
};

const TABS = [
  { value: "all", label: "All", href: "/dashboard/projects" },
  ...PUBLICATION_STATUSES.map((item) => ({
    value: item.value,
    label: item.label,
    href: `/dashboard/projects?status=${item.value}`,
  })),
];

export default async function MyProjectsPage({
  searchParams,
}: PageProps<"/dashboard/projects">) {
  const params = await searchParams;
  const user = await requireUser("/dashboard");

  const rawStatus = first(params.status) ?? "all";
  const status = (
    PUBLICATION_STATUSES.some((item) => item.value === rawStatus)
      ? rawStatus
      : "all"
  ) as ProjectPublicationStatus | "all";

  const rawPage = Number(first(params.page) ?? "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const [result, counts, moderation] = await Promise.all([
    listMyProjects(user.id, { publicationStatus: status, page }),
    countMyProjects(user.id),
    isModerationEnabled(),
  ]);

  const flash =
    params.deleted === "1"
      ? "Project deleted."
      : params.created === "1"
        ? "Draft created — finish the write-up and submit when ready."
        : null;

  const tabs = TABS.map((tab) => ({
    ...tab,
    label:
      tab.value === "all"
        ? `All ${counts.total}`
        : `${tab.label} ${counts.tally[tab.value] ?? 0}`,
  }));

  return (
    <div className="w-full py-8 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Workspace</Eyebrow>
          <h1 className="text-2xl font-bold tracking-tight text-gh-fg-default">
            My projects
          </h1>
          <p className="mt-1 text-sm text-gh-fg-muted">
            Everything you own, including work that is not public yet.
          </p>
        </div>
        <LinkButton
          href="/dashboard/projects/new"
          variant="default"
          leadingIcon="add"
        >
          New project
        </LinkButton>
      </div>

      {flash && <Alert tone="success" className="mb-6">{flash}</Alert>}

      <div className="mb-6 overflow-x-auto">
        <TabLinks tabs={tabs} active={status} label="Filter by status" />
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon="folder_open"
          title={status === "all" ? "No projects yet" : `No ${status.replace("_", " ")} projects`}
          description={
            status === "all"
              ? "You haven't created a project yet — name it, add a cover and publish in about two minutes."
              : "Switch the filter to see the rest of your work."
          }
          action={
            status === "all" ? (
              <LinkButton href="/dashboard/projects/new" variant="primary" leadingIcon="add">
                Add a project
              </LinkButton>
            ) : (
              <LinkButton href="/dashboard/projects" variant="default">
                Show everything
              </LinkButton>
            )
          }
        />
      ) : (
        <ul className="space-y-4">
          {result.items.map((project) => {
            const isPublic = ["approved", "published"].includes(
              project.publicationStatus,
            );

            return (
              <li
                key={project.id}
                className="rounded-lg border border-gh-border bg-gh-card p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-md border border-gh-border bg-gh-inset sm:h-20 sm:w-36">
                    {project.coverImage ? (
                      <Image
                        src={withBase(project.coverImage)}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 144px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-gh-fg-subtle">
                        <Icon name="image" size={20} />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/projects/${project.id}/edit`}
                          className="block truncate text-base font-semibold text-gh-fg-default hover:text-gh-accent"
                        >
                          {project.title}
                        </Link>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gh-fg-muted">
                          {project.shortDescription}
                        </p>
                      </div>
                      <StatusBadge status={project.publicationStatus} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-gh-fg-subtle">
                      <span className="inline-flex items-center gap-1">
                        <Icon name="history" size={13} />
                        Updated {relativeTime(project.updatedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="group" size={13} />
                        {project.memberCount} member{project.memberCount === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="visibility" size={13} />
                        {project.viewCount} views
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="favorite" size={13} />
                        {project.likeCount}
                      </span>
                      {project.featured && (
                        <Badge tone="attention">Featured</Badge>
                      )}
                    </div>

                    {project.publicationStatus === "rejected" && project.reviewNote && (
                      <p className="mt-3 rounded-md border border-[rgba(248,81,73,0.4)] bg-[rgba(147,0,10,0.25)] px-3 py-2 text-xs text-gh-fg-default">
                        <span className="font-semibold">Moderator note:</span>{" "}
                        {project.reviewNote}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <LinkButton
                          href={`/dashboard/projects/${project.id}/edit`}
                          size="sm"
                          variant="default"
                          leadingIcon="edit"
                        >
                          Edit
                        </LinkButton>

                        {isPublic && (
                          <LinkButton
                            href={`/projects/${project.slug}`}
                            size="sm"
                            variant="ghost"
                            leadingIcon="open_in_new"
                          >
                            Public page
                          </LinkButton>
                        )}
                      </div>

                      <ProjectActions
                        projectId={project.id}
                        status={project.publicationStatus}
                        moderation={moderation}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        basePath="/dashboard/projects"
        searchParams={flattenParams({ ...params, status: status === "all" ? undefined : status })}
        className="mt-8"
      />
    </div>
  );
}
