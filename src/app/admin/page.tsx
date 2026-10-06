import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Tag";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getAdminOverview,
  listRecentAuditLogs,
  statusLabel,
  statusTone,
} from "@/lib/data/admin";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin overview",
  description: "Moderation counts, recent submissions and open reports.",
};

const TONE_BAR: Record<string, string> = {
  accent: "bg-gh-accent",
  success: "bg-gh-success",
  attention: "bg-gh-attention",
  danger: "bg-gh-danger",
  muted: "bg-gh-fg-subtle",
};

const TONE_BADGE: Record<string, "accent" | "success" | "attention" | "danger" | "muted"> = {
  accent: "accent",
  success: "success",
  attention: "attention",
  danger: "danger",
  muted: "muted",
};

function Metric({
  label,
  value,
  icon,
  href,
  tone = "text-gh-fg-default",
}: {
  label: string;
  value: number;
  icon: string;
  href: string;
  tone?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-gh-border bg-gh-card p-4 transition-colors hover:border-gh-fg-subtle"
    >
      <p className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
        <Icon name={icon} size={14} />
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-gh-accent opacity-0 transition-opacity group-hover:opacity-100">
        Open <Icon name="arrow_forward" size={14} />
      </p>
    </Link>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [overview, activity] = await Promise.all([
    getAdminOverview(),
    listRecentAuditLogs(6),
  ]);

  const { totals, statusCounts, recentSubmissions, openReports } = overview;
  const maxCount = Math.max(1, ...statusCounts.map((item) => item.count));

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Overview"
        title="Library at a glance"
        description="Live counts from the database: what is waiting for review, what students submitted lately and where moderation is needed."
        action={
          <LinkButton
            href="/admin/projects"
            variant="primary"
            leadingIcon="fact_check"
          >
            Open review queue
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          label="Awaiting review"
          value={totals.awaitingReview}
          icon="pending_actions"
          href="/admin/projects?status=submitted"
          tone="text-gh-attention"
        />
        <Metric
          label="Open reports"
          value={totals.openReports}
          icon="flag"
          href="/admin/reports?status=open"
          tone={totals.openReports > 0 ? "text-gh-danger" : "text-gh-fg-default"}
        />
        <Metric
          label="Students"
          value={totals.students}
          icon="group"
          href="/admin/students"
        />
        <Metric
          label="Published"
          value={totals.published}
          icon="public"
          href="/admin/projects?status=published"
          tone="text-gh-success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel padded={false}>
          <PanelHeader
            title="Projects by publication status"
            description={`${totals.projects} projects in the archive`}
            action={
              <Link
                href="/admin/projects"
                className="text-xs font-semibold text-gh-accent hover:underline"
              >
                Review them
              </Link>
            }
          />
          <ul className="divide-y divide-gh-border-muted">
            {statusCounts.map((item) => {
              const width = Math.round((item.count / maxCount) * 100);
              return (
                <li
                  key={item.status}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <Link
                    href={`/admin/projects?status=${item.status}`}
                    className="w-32 shrink-0 text-sm font-medium text-gh-fg-default hover:text-gh-accent"
                  >
                    {item.label}
                  </Link>
                  <span
                    aria-hidden
                    className="h-2 flex-1 overflow-hidden rounded-sm bg-gh-inset"
                  >
                    <span
                      className={`block h-full rounded-sm ${TONE_BAR[item.tone] ?? "bg-gh-fg-subtle"}`}
                      style={{ width: `${width}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right font-mono text-sm text-gh-fg-default">
                    {item.count}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel padded={false}>
          <PanelHeader title="Recent moderation activity" description="Audit log" />
          {activity.length > 0 ? (
            <ul className="divide-y divide-gh-border-muted">
              {activity.map((entry) => (
                <li key={entry.id} className="px-4 py-3">
                  <p className="text-sm text-gh-fg-default">
                    <span className="font-medium">
                      {entry.actor?.name ?? "System"}
                    </span>{" "}
                    <span className="font-mono text-xs text-gh-accent">
                      {entry.action}
                    </span>
                  </p>
                  {entry.detail && (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gh-fg-muted">
                      {entry.detail}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[11px] text-gh-fg-subtle">
                    {relativeTime(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon="history"
              title="No activity yet"
              description="Actions taken in this console appear here."
            />
          )}
        </Panel>
      </div>

      <Panel padded={false}>
        <PanelHeader
          title="Recently submitted"
          description="Newest hand-ins waiting for a decision"
          action={
            <Link
              href="/admin/projects"
              className="text-xs font-semibold text-gh-accent hover:underline"
            >
              Full queue
            </Link>
          }
        />
        {recentSubmissions.length > 0 ? (
          <ul className="divide-y divide-gh-border-muted">
            {recentSubmissions.map((project) => (
              <li
                key={project.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/projects/${project.id}`}
                      className="truncate text-sm font-semibold text-gh-fg-default hover:text-gh-accent"
                    >
                      {project.title}
                    </Link>
                    <Badge tone={TONE_BADGE[statusTone(project.publicationStatus)] ?? "muted"}>
                      {statusLabel(project.publicationStatus)}
                    </Badge>
                    {project.openReportCount > 0 && (
                      <Badge tone="danger">
                        {project.openReportCount} open report
                        {project.openReportCount === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-gh-fg-muted">
                    {project.owner?.name ?? "Unknown owner"} ·{" "}
                    {project.department?.name ?? "No department"} ·{" "}
                    {relativeTime(project.submittedAt ?? project.createdAt)}
                  </p>
                </div>
                <Link
                  href={`/projects/${project.slug}`}
                  className="shrink-0 text-xs font-semibold text-gh-accent hover:underline"
                >
                  View public page
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon="inbox"
            title="Nothing has been submitted"
            description="Projects show up here the moment a student hands one in."
          />
        )}
      </Panel>

      <Panel padded={false}>
        <PanelHeader
          title="Open reports"
          description="Flagged by students and visitors"
          action={
            <Link
              href="/admin/reports?status=open"
              className="text-xs font-semibold text-gh-accent hover:underline"
            >
              Triage all
            </Link>
          }
        />
        {openReports.length > 0 ? (
          <ul className="divide-y divide-gh-border-muted">
            {openReports.map((report) => (
              <li
                key={report.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gh-fg-default">
                    <span className="font-mono text-xs uppercase tracking-wide text-gh-danger">
                      {report.reason}
                    </span>{" "}
                    on{" "}
                    <Link
                      href={`/admin/projects/${report.project.id}`}
                      className="font-medium hover:text-gh-accent"
                    >
                      {report.project.title}
                    </Link>
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-gh-fg-muted">
                    {report.reporter
                      ? `Signed-in reporter · ${report.reporter.name}`
                      : "Anonymous reporter"}{" "}
                    · {relativeTime(report.createdAt)}
                  </p>
                </div>
                <Link
                  href="/admin/reports?status=open"
                  className="shrink-0 text-xs font-semibold text-gh-accent hover:underline"
                >
                  Open queue
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon="verified_user"
            title="No open reports"
            description="Nothing is waiting for moderation right now."
          />
        )}
      </Panel>
    </div>
  );
}
