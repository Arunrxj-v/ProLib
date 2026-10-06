import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ReviewActions } from "@/components/admin/ReviewActions";
import { Markdown } from "@/components/project/Markdown";
import { Avatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Alert, EmptyState, Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge, TechTag } from "@/components/ui/Tag";
import { requireAdmin } from "@/lib/auth/guards";
import {
  LIFECYCLE_STATUSES,
  PROJECT_SECTION_KEYS,
  PROJECT_TYPES,
  type ProjectPublicationStatus,
} from "@/lib/constants";
import {
  getAdminProjectDetail,
  statusLabel,
} from "@/lib/data/admin";
import { formatDate, relativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Review project",
  description: "Read a submission end to end and record a moderation decision.",
};

const SECTION_LABELS = new Map(
  PROJECT_SECTION_KEYS.map((item) => [item.value, item.label]),
);

const HISTORY_LABELS: Record<string, string> = {
  "project.approve": "Approved",
  "project.reject": "Rejected / changes requested",
  "project.publish": "Published",
  "project.unpublish": "Unpublished",
  "project.feature": "Featured in showcase",
  "project.unfeature": "Removed from showcase",
  "report.resolved": "Report resolved",
  "report.dismissed": "Report dismissed",
};

function labelFor(
  list: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return list.find((item) => item.value === value)?.label ?? "—";
}

const STATUS_TONE = {
  draft: "muted",
  submitted: "accent",
  in_review: "attention",
  approved: "success",
  rejected: "danger",
  published: "success",
} as const;

const LIFECYCLE_TONE = {
  in_progress: "attention",
  completed: "success",
  archived: "muted",
} as const;

export default async function AdminProjectDetailPage({
  params,
}: PageProps<"/admin/projects/[id]">) {
  await requireAdmin();

  const { id } = await params;
  const detail = await getAdminProjectDetail(id);
  if (!detail) notFound();

  const { project, owner, reviewer, members, technologies, images, sections, reports, history } =
    detail;

  const status = project.publicationStatus as ProjectPublicationStatus;

  const meta: Array<{ icon: string; label: string; value: string }> = [
    { icon: "link", label: "Slug", value: project.slug },
    {
      icon: "category",
      label: "Type",
      value: labelFor(PROJECT_TYPES, project.projectType),
    },
    {
      icon: "flag",
      label: "Stage",
      value: labelFor(LIFECYCLE_STATUSES, project.status),
    },
    { icon: "corporate_fare", label: "Department", value: detail.department?.name ?? "—" },
    { icon: "label", label: "Category", value: detail.category?.name ?? "—" },
    { icon: "school", label: "Academic year", value: detail.academicYear ?? "—" },
    { icon: "today", label: "Semester", value: detail.semester ?? "—" },
    { icon: "person", label: "Owner", value: owner.name },
    { icon: "mail", label: "Owner email", value: owner.email },
    { icon: "event", label: "Created", value: formatDate(project.createdAt) },
    {
      icon: "upload",
      label: "Submitted",
      value: project.submittedAt
        ? `${formatDate(project.submittedAt)} (${relativeTime(project.submittedAt)})`
        : "Never submitted",
    },
    {
      icon: "review",
      label: "Reviewed",
      value: project.reviewedAt
        ? `${formatDate(project.reviewedAt)}${reviewer ? ` by ${reviewer.name}` : ""}`
        : "Not reviewed yet",
    },
    {
      icon: "publish",
      label: "Published",
      value: project.publishedAt
        ? `${formatDate(project.publishedAt)} (${relativeTime(project.publishedAt)})`
        : "Not published",
    },
    { icon: "visibility", label: "Views", value: project.viewCount.toLocaleString() },
    { icon: "favorite", label: "Likes", value: project.likeCount.toLocaleString() },
  ];

  const links = [
    { href: project.githubUrl, icon: "code", label: "Repository" },
    { href: project.demoUrl, icon: "rocket_launch", label: "Live demo" },
    { href: project.docsUrl, icon: "description", label: "Docs" },
    { href: project.videoUrl, icon: "smart_display", label: "Walkthrough" },
  ].filter((link): link is { href: string; icon: string; label: string } =>
    Boolean(link.href),
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={`Review queue · ${statusLabel(status)}`}
        title={project.title}
        description={project.shortDescription}
        action={
          <>
            <LinkButton href="/admin/projects" variant="ghost" leadingIcon="arrow_back">
              Queue
            </LinkButton>
            <LinkButton
              href={`/projects/${project.slug}`}
              variant="default"
              leadingIcon="open_in_new"
            >
              Public page
            </LinkButton>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[status] ?? "muted"} dot>
          {statusLabel(status)}
        </Badge>
        <Badge tone={LIFECYCLE_TONE[project.status] ?? "muted"}>
          {labelFor(LIFECYCLE_STATUSES, project.status)}
        </Badge>
        {project.featured && <Badge tone="attention">Featured in showcase</Badge>}
        {reports.some((report) => report.status === "open") && (
          <Badge tone="danger">
            {reports.filter((report) => report.status === "open").length} open report
            {reports.filter((report) => report.status === "open").length === 1 ? "" : "s"}
          </Badge>
        )}
        <span className="font-mono text-[11px] text-gh-fg-subtle">
          /projects/{project.slug}
        </span>
      </div>

      {project.reviewNote && (
        <Alert
          tone={status === "rejected" ? "danger" : "attention"}
          title={
            status === "rejected"
              ? "Last note sent to the team"
              : "Review note on record"
          }
        >
          {project.reviewNote}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Panel padded={false}>
            <PanelHeader title="Submission details" description="Every stored field" />
            <dl className="divide-y divide-gh-border-muted">
              {meta.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start justify-between gap-4 px-4 py-2.5"
                >
                  <dt className="flex items-center gap-1.5 text-xs text-gh-fg-muted">
                    <Icon name={item.icon} size={14} />
                    {item.label}
                  </dt>
                  <dd className="break-all text-right font-mono text-xs text-gh-fg-default">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
            {links.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-gh-border-muted p-4">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-btn-bg px-3 py-1.5 text-xs font-medium text-gh-fg-default transition-colors hover:bg-gh-btn-hover"
                  >
                    <Icon name={link.icon} size={15} tone="accent" />
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </Panel>

          <Panel padded={false}>
            <PanelHeader
              title="Write-up"
              description={`${sections.length} section${sections.length === 1 ? "" : "s"} stored`}
            />
            <div className="p-5">
              <Markdown>{project.description ?? project.shortDescription}</Markdown>
            </div>
          </Panel>

          <Panel padded={false}>
            <PanelHeader title="Narrative sections" description="Markdown, in display order" />
            {sections.length > 0 ? (
              <div className="divide-y divide-gh-border-muted">
                {sections.map((section) => (
                  <article key={section.id} className="p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-gh-fg-default">
                        {section.title ?? SECTION_LABELS.get(section.key) ?? section.key}
                      </h3>
                      <Badge tone="muted">{section.key}</Badge>
                      <Badge tone={section.visible ? "success" : "attention"}>
                        {section.visible ? "Visible" : "Hidden"}
                      </Badge>
                    </div>
                    {section.content ? (
                      <Markdown>{section.content}</Markdown>
                    ) : (
                      <p className="text-sm text-gh-fg-subtle">No content.</p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                icon="description"
                title="No narrative sections"
                description="The team has not written any structured sections yet."
              />
            )}
          </Panel>

          <Panel padded={false}>
            <PanelHeader
              title={`Team · ${members.length}`}
              description="Membership rows, not free text"
            />
            <ul className="divide-y divide-gh-border-muted">
              {members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={member.name} src={member.avatarUrl} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gh-fg-default">
                      {member.username ? (
                        <Link
                          href={`/students/${member.username}`}
                          className="hover:text-gh-accent"
                        >
                          {member.name}
                        </Link>
                      ) : (
                        member.name
                      )}
                      {member.isOwner && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-gh-accent">
                          owner
                        </span>
                      )}
                    </p>
                    <p className="truncate font-mono text-[11px] text-gh-fg-muted">
                      {member.email} · {member.role}
                    </p>
                  </div>
                  <span
                    className={`ml-auto shrink-0 font-mono text-[11px] ${
                      member.isOwner ? "text-gh-accent" : "text-gh-fg-subtle"
                    }`}
                  >
                    {member.isOwner ? "owner" : "member"}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel padded={false}>
            <PanelHeader
              title="Tech stack"
              description={`${technologies.length} technologies linked`}
            />
            <div className="flex flex-wrap gap-1.5 p-5">
              {technologies.length > 0 ? (
                technologies.map((technology) => (
                  <TechTag
                    key={technology.id}
                    name={technology.name}
                    slug={technology.slug}
                    icon={technology.icon}
                    tone="accent"
                  />
                ))
              ) : (
                <p className="text-sm text-gh-fg-subtle">No technologies linked.</p>
              )}
            </div>
          </Panel>

          <Panel padded={false}>
            <PanelHeader
              title="Gallery"
              description={`${images.length} image${images.length === 1 ? "" : "s"} attached`}
            />
            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
                {images.map((image) => (
                  <figure
                    key={image.id}
                    className="relative aspect-[16/10] overflow-hidden rounded-md border border-gh-border bg-gh-inset"
                  >
                    <Image
                      src={image.path}
                      alt={image.alt ?? `${project.title} screenshot`}
                      fill
                      sizes="(max-width: 640px) 50vw, 240px"
                      className="object-cover"
                    />
                    {image.caption && (
                      <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gh-inset/85 px-2 py-1 font-mono text-[11px] text-gh-fg-muted">
                        {image.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                icon="image"
                title="No gallery images"
                description="Screenshots uploaded by the team appear here."
              />
            )}
          </Panel>
        </div>

        <aside className="space-y-6 self-start lg:sticky lg:top-6">
          <ReviewActions projectId={project.id} status={status} featured={project.featured} />

          <Panel padded={false}>
            <PanelHeader
              title="Reports"
              description={`${reports.length} filed against this project`}
              action={
                <Link
                  href="/admin/reports"
                  className="text-xs font-semibold text-gh-accent hover:underline"
                >
                  All reports
                </Link>
              }
            />
            {reports.length > 0 ? (
              <ul className="divide-y divide-gh-border-muted">
                {reports.map((report) => (
                  <li key={report.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          report.status === "open"
                            ? "danger"
                            : report.status === "resolved"
                              ? "success"
                              : "muted"
                        }
                      >
                        {report.status}
                      </Badge>
                      <span className="font-mono text-xs uppercase tracking-wide text-gh-fg-default">
                        {report.reason}
                      </span>
                    </div>
                    {report.details && (
                      <p className="mt-1 text-xs leading-relaxed text-gh-fg-muted">
                        {report.details}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-[11px] text-gh-fg-subtle">
                      {report.reporter?.name ?? "Anonymous"} ·{" "}
                      {relativeTime(report.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon="verified_user"
                title="No reports"
                description="Nobody has flagged this project."
              />
            )}
          </Panel>

          <Panel padded={false}>
            <PanelHeader
              title="Review history"
              description="Audit log entries for this project"
            />
            {history.length > 0 ? (
              <ol className="divide-y divide-gh-border-muted">
                {history.map((entry) => (
                  <li key={entry.id} className="px-4 py-3">
                    <p className="text-sm text-gh-fg-default">
                      <span className="font-medium">
                        {HISTORY_LABELS[entry.action] ?? entry.action}
                      </span>
                    </p>
                    {entry.detail && (
                      <p className="mt-0.5 text-xs leading-relaxed text-gh-fg-muted">
                        {entry.detail}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-[11px] text-gh-fg-subtle">
                      {entry.actor?.name ?? "System"} ·{" "}
                      {formatDate(entry.createdAt)} · {relativeTime(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                compact
                icon="history"
                title="No decisions recorded"
                description="Approvals, rejections and publications appear here."
              />
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
