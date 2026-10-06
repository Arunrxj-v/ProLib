import type { Metadata } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Alert, EmptyState, Panel, PanelHeader } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Tag";
import { requireUser } from "@/lib/auth/guards";
import {
  countMyProjects,
  getProfileChecks,
  getReviewActivity,
  listMyProjects,
} from "@/lib/data/myProjects";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your projects, review status and profile completeness.",
};

const STATUS_ORDER = [
  "draft",
  "submitted",
  "in_review",
  "approved",
  "published",
  "rejected",
] as const;

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const params = await searchParams;
  const user = await requireUser("/dashboard");

  const [counts, recent, profile, activity] = await Promise.all([
    countMyProjects(user.id),
    listMyProjects(user.id, { pageSize: 4 }),
    getProfileChecks(user.id),
    getReviewActivity(user.id),
  ]);

  const flash =
    params.deleted === "1"
      ? "Project deleted."
      : params.denied === "1"
        ? "That project is not yours to change."
        : null;

  const completion = Math.round((profile.complete / profile.total) * 100);
  const pending = recent.items.filter((item) =>
    ["submitted", "in_review"].includes(item.publicationStatus),
  );

  return (
    <div className="w-full py-8 sm:py-10">
      {flash && <Alert tone="success" className="mb-6">{flash}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {/* Status tally */}
          <section aria-labelledby="dash-status">
            <div className="mb-4 flex items-end justify-between gap-3 border-b border-gh-border pb-3">
              <div>
                <Eyebrow>Library</Eyebrow>
                <h2 id="dash-status" className="text-lg font-semibold text-gh-fg-default">
                  Your submissions
                </h2>
              </div>
              <Link
                href="/dashboard/projects/new"
                className="inline-flex items-center gap-1 text-xs font-semibold text-gh-accent hover:underline"
              >
                New project
                <Icon name="arrow_forward" size={14} />
              </Link>
            </div>

            {counts.total === 0 ? (
              <EmptyState
                icon="deployment"
                title="Nothing published yet"
                description="Start with your capstone, a hackathon build or a personal tool — a moderator reviews it before it appears publicly."
                action={
                  <LinkButton href="/dashboard/projects/new" variant="default" leadingIcon="add">
                    Create your first project
                  </LinkButton>
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {STATUS_ORDER.map((status) => (
                  <Link
                    key={status}
                    href={`/dashboard/projects?status=${status}`}
                    className="rounded-lg border border-gh-border bg-gh-card p-4 transition-colors hover:border-gh-fg-subtle"
                  >
                    <span className="block font-mono text-2xl font-semibold text-gh-fg-default">
                      {counts.tally[status] ?? 0}
                    </span>
                    <span className="mt-1 block text-xs capitalize text-gh-fg-muted">
                      {status.replace("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Recent projects */}
          <section aria-labelledby="dash-recent">
            <div className="mb-4 flex items-end justify-between gap-3 border-b border-gh-border pb-3">
              <div>
                <Eyebrow>Continue</Eyebrow>
                <h2 id="dash-recent" className="text-lg font-semibold text-gh-fg-default">
                  Recently updated
                </h2>
              </div>
              <Link
                href="/dashboard/projects"
                className="text-xs font-semibold text-gh-accent hover:underline"
              >
                All projects
              </Link>
            </div>

            {recent.items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gh-border bg-gh-card p-6 text-sm text-gh-fg-muted">
                No projects yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {recent.items.map((project) => (
                  <li
                    key={project.id}
                    className="rounded-lg border border-gh-border bg-gh-card p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/projects/${project.id}/edit`}
                          className="block truncate text-sm font-semibold text-gh-fg-default hover:text-gh-accent"
                        >
                          {project.title}
                        </Link>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gh-fg-muted">
                          {project.shortDescription}
                        </p>
                      </div>
                      <StatusBadge status={project.publicationStatus} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-gh-fg-subtle">
                      <span>Updated {relativeTime(project.updatedAt)}</span>
                      <span>{project.memberCount} member{project.memberCount === 1 ? "" : "s"}</span>
                      <span>{project.viewCount} views</span>
                      {project.reviewNote && project.publicationStatus === "rejected" && (
                        <span className="text-gh-danger">Moderator note attached</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Review activity */}
          <section aria-labelledby="dash-activity">
            <div className="mb-4 flex items-end justify-between gap-3 border-b border-gh-border pb-3">
              <div>
                <Eyebrow>Moderation</Eyebrow>
                <h2 id="dash-activity" className="text-lg font-semibold text-gh-fg-default">
                  Review activity
                </h2>
              </div>
              <Link
                href="/dashboard/notifications"
                className="text-xs font-semibold text-gh-accent hover:underline"
              >
                View all
              </Link>
            </div>

            {activity.length === 0 ? (
              <p className="text-sm text-gh-fg-muted">
                Submit a project and its review trail will show up here.
              </p>
            ) : (
              <ol className="space-y-3">
                {activity.slice(0, 4).map((event) => (
                  <li
                    key={event.projectId}
                    className="flex items-start gap-3 border-l-2 border-gh-border pl-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/projects/${event.projectId}/edit`}
                          className="truncate text-sm font-medium text-gh-fg-default hover:text-gh-accent"
                        >
                          {event.title}
                        </Link>
                        <StatusBadge status={event.publicationStatus} />
                      </div>
                      <p className="mt-0.5 text-xs text-gh-fg-muted">
                        {event.publicationStatus === "rejected" && event.reviewNote
                          ? `Rejected: ${event.reviewNote}`
                          : event.reviewedAt
                            ? `Reviewed ${relativeTime(event.reviewedAt)}`
                            : event.submittedAt
                              ? `Submitted ${relativeTime(event.submittedAt)}`
                              : "Awaiting submission"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <Panel padded={false}>
            <PanelHeader
              title="Profile completeness"
              description={`${profile.complete} of ${profile.total} steps done`}
            />
            <div className="p-5">
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-gh-inset"
                role="progressbar"
                aria-valuenow={completion}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Profile completeness"
              >
                <div
                  className="h-full rounded-full bg-gh-success transition-all"
                  style={{ width: `${completion}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-xs text-gh-fg-muted">
                {completion}% complete
              </p>

              <ul className="mt-4 space-y-2">
                {profile.checks.map((check) => (
                  <li key={check.label} className="flex items-start gap-2 text-xs">
                    <Icon
                      name={check.done ? "check_circle" : "radio_button_unchecked"}
                      size={15}
                      tone={check.done ? "success" : "muted"}
                      className="mt-px shrink-0"
                    />
                    <span className={check.done ? "text-gh-fg-muted" : "text-gh-fg-default"}>
                      {check.label}
                    </span>
                    {!check.done && (
                      <Link
                        href={check.href}
                        className="ml-auto shrink-0 text-gh-accent hover:underline"
                      >
                        Fix
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel padded={false}>
            <PanelHeader title="In review right now" />
            <div className="p-5">
              {pending.length === 0 ? (
                <p className="text-sm text-gh-fg-muted">
                  Nothing is waiting on a moderator.
                </p>
              ) : (
                <ul className="space-y-3">
                  {pending.map((project) => (
                    <li key={project.id}>
                      <Link
                        href={`/dashboard/projects/${project.id}/edit`}
                        className="block text-sm font-medium text-gh-fg-default hover:text-gh-accent"
                      >
                        {project.title}
                      </Link>
                      <p className="text-xs text-gh-fg-muted">
                        Submitted {project.submittedAt ? relativeTime(project.submittedAt) : "just now"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
