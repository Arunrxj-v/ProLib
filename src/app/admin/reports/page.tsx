import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ReportRowActions } from "@/components/admin/ReportRowActions";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TabLinks } from "@/components/ui/Navigation";
import { EmptyState } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Tag";
import { requireAdmin } from "@/lib/auth/guards";
import { listAdminReports } from "@/lib/data/admin";
import { first } from "@/lib/data/filters";
import { reportReasonLabel } from "@/lib/reporting";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reports",
  description: "Triage reports filed against student projects.",
};

const TABS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

function isTab(
  value: string | undefined,
): value is "open" | "resolved" | "dismissed" | "all" {
  return TABS.some((tab) => tab.value === value);
}

export default async function AdminReportsPage({
  searchParams,
}: PageProps<"/admin/reports">) {
  await requireAdmin();

  const params = await searchParams;
  const raw = first(params.status);
  const status = isTab(raw) ? raw : "open";

  const items = await listAdminReports({ status, limit: 100 });

  const tabs = TABS.map((tab) => ({
    ...tab,
    href:
      tab.value === "open"
        ? "/admin/reports"
        : `/admin/reports?status=${tab.value}`,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Moderation"
        title="Report queue"
        description="Flags raised by students and anonymous visitors. Resolving records your decision in the audit log; dismissing keeps the record without acting on it."
        action={
          <LinkButton href="/admin/projects" variant="ghost" leadingIcon="fact_check">
            Review queue
          </LinkButton>
        }
      />

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabLinks tabs={tabs} active={status} label="Filter reports by status" />
      </div>

      <p className="text-sm text-gh-fg-muted">
        <span className="font-semibold text-gh-fg-default">{items.length}</span>{" "}
        {items.length === 1 ? "report" : "reports"}
        {status !== "all" && <> marked {status}</>}
      </p>

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((report) => (
            <li key={report.id}>
              <article className="rounded-lg border border-gh-border bg-gh-card p-4 transition-colors hover:border-gh-fg-subtle sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          report.status === "open"
                            ? "danger"
                            : report.status === "resolved"
                              ? "success"
                              : "muted"
                        }
                        dot
                      >
                        {report.status}
                      </Badge>
                      <Badge tone="attention">{reportReasonLabel(report.reason)}</Badge>
                      <Badge tone="muted">{report.project.publicationStatus}</Badge>
                    </div>

                    <h2 className="mt-2 text-base font-semibold text-gh-fg-default">
                      <Link
                        href={`/admin/projects/${report.project.id}`}
                        className="hover:text-gh-accent"
                      >
                        {report.project.title}
                      </Link>
                    </h2>
                    <p className="mt-0.5 font-mono text-[11px] text-gh-fg-subtle">
                      /projects/{report.project.slug}
                    </p>

                    {report.details && (
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gh-fg-muted">
                        {report.details}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-gh-fg-muted">
                      <span className="flex items-center gap-1.5">
                        <Icon name="person" size={13} />
                        {report.reporter
                          ? `${report.reporter.name} (signed in)`
                          : "Anonymous visitor"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Icon name="schedule" size={13} />
                        {relativeTime(report.createdAt)}
                      </span>
                      {report.resolvedAt && (
                        <span className="flex items-center gap-1.5 text-gh-success">
                          <Icon name="check_circle" size={13} tone="success" />
                          Closed {relativeTime(report.resolvedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-2">
                    {report.status === "open" ? (
                      <ReportRowActions reportId={report.id} />
                    ) : (
                      <Badge tone="muted">{report.status}</Badge>
                    )}
                    <Link
                      href={`/projects/${report.project.slug}`}
                      className="text-xs font-semibold text-gh-accent hover:underline"
                    >
                      View public page
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={status === "open" ? "verified_user" : "filter_alt_off"}
          title={status === "open" ? "No open reports" : "Nothing here yet"}
          description={
            status === "open"
              ? "Nothing is waiting for moderation — the queue is clear."
              : `No report currently has the status “${status}”.`
          }
          action={
            <LinkButton href="/admin/reports" variant="default">
              Back to open reports
            </LinkButton>
          }
        />
      )}
    </div>
  );
}
