import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/project/Markdown";
import { LikeButton } from "@/components/project/LikeButton";
import { ViewBeacon } from "@/components/project/ViewBeacon";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/Button";
import { Alert, EmptyState } from "@/components/ui/Panel";
import { Badge, Eyebrow, TechTag } from "@/components/ui/Tag";
import { getCurrentUser } from "@/lib/auth/session";
import {
  LIFECYCLE_STATUSES,
  PROJECT_SECTION_KEYS,
  PROJECT_TYPES,
  PUBLICATION_STATUSES,
  SITE,
} from "@/lib/constants";
import {
  getProjectBySlug,
  getPublicStatuses,
  getRelatedProjects,
  hasUserLiked,
} from "@/lib/data/projects";
import { fetchPublicRepoMeta, parseGithubRepoUrl } from "@/lib/github";
import { formatDate, relativeTime, truncate } from "@/lib/utils";

type Params = { slug: string };

const SECTION_LABELS = new Map(
  PROJECT_SECTION_KEYS.map((item) => [item.value, item.label]),
);

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

/** One shared visibility rule for the page, metadata and related queries. */
async function loadVisibleProject(slug: string) {
  const [detail, user] = await Promise.all([
    getProjectBySlug(slug),
    getCurrentUser(),
  ]);

  if (!detail) return null;

  const statuses = await getPublicStatuses();
  const isOwner = user?.id === detail.project.ownerId;
  const canView =
    statuses.includes(detail.project.publicationStatus) ||
    Boolean(isOwner) ||
    user?.role === "admin";

  if (!canView) return null;
  return { detail, user, isOwner: Boolean(isOwner) };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadVisibleProject(slug);
  if (!loaded) return { title: "Project not found" };

  const { project } = loaded.detail;
  const description = truncate(project.shortDescription, 160);

  return {
    title: `${project.title} — ${SITE.name}`,
    description,
    openGraph: {
      title: project.title,
      description,
      type: "article",
      images: project.coverImage ? [{ url: project.coverImage }] : undefined,
    },
    alternates: { canonical: `/projects/${project.slug}` },
  };
}

export default async function ProjectPage({
  params,
}: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const loaded = await loadVisibleProject(slug);
  if (!loaded) notFound();

  const { detail, user, isOwner } = loaded;
  const { project, owner, members, technologies, images, sections } = detail;

  const repoRef = parseGithubRepoUrl(project.githubUrl);
  const [related, likedByViewer, repoMeta] = await Promise.all([
    getRelatedProjects(project, 3),
    hasUserLiked(project.id, user?.id ?? null),
    repoRef ? fetchPublicRepoMeta(repoRef.owner, repoRef.repo) : null,
  ]);

  /** Language share by bytes — computed only from real GitHub responses. */
  const languageBreakdown =
    repoMeta?.available && Object.keys(repoMeta.languages).length > 0
      ? (() => {
          const total =
            Object.values(repoMeta.languages).reduce(
              (sum, bytes) => sum + bytes,
              0,
            ) || 1;
          return Object.entries(repoMeta.languages)
            .sort(([, a], [, b]) => b - a)
            .map(([name, bytes]) => ({
              name,
              percent: Math.max(1, Math.round((bytes / total) * 100)),
            }));
        })()
      : [];

  const canModerate = user?.role === "admin";
  const canEdit = Boolean(user) && (isOwner || canModerate);

  const links = [
    {
      href: project.githubUrl,
      icon: "code",
      label: repoRef ? "GitHub" : "Repository",
    },
    { href: project.demoUrl, icon: "rocket_launch", label: "Live demo" },
    { href: project.docsUrl, icon: "description", label: "Documentation" },
    { href: project.videoUrl, icon: "smart_display", label: "Walkthrough" },
  ].filter((link): link is { href: string; icon: string; label: string } =>
    Boolean(link.href),
  );

  const meta: Array<{ icon: string; label: string; value: string }> = [
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
    detail.department && {
      icon: "corporate_fare",
      label: "Department",
      value: detail.department.name,
    },
    detail.category && {
      icon: detail.category.icon ?? "label",
      label: "Category",
      value: detail.category.name,
    },
    detail.academicYear && {
      icon: "school",
      label: "Academic year",
      value: detail.academicYear,
    },
    detail.semester && {
      icon: "today",
      label: "Semester",
      value: detail.semester,
    },
    {
      icon: "schedule",
      label: "Published",
      value: formatDate(project.publishedAt ?? project.createdAt),
    },
  ].filter((item): item is { icon: string; label: string; value: string } =>
    Boolean(item),
  );

  return (
    <div className="w-full">
      <ViewBeacon slug={project.slug} />

      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <nav
            aria-label="Breadcrumb"
            className="mb-5 flex flex-wrap items-center gap-1.5 font-mono text-xs text-gh-fg-muted"
          >
            <Link href="/explore" className="hover:text-gh-accent">
              Explore
            </Link>
            <Icon name="chevron_right" size={14} />
            {detail.department && (
              <>
                <Link
                  href={`/explore?department=${detail.department.slug}`}
                  className="hover:text-gh-accent"
                >
                  {detail.department.name}
                </Link>
                <Icon name="chevron_right" size={14} />
              </>
            )}
            <span className="text-gh-fg-default">{project.title}</span>
          </nav>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone="accent">{labelFor(PROJECT_TYPES, project.projectType)}</Badge>
            <Badge tone={LIFECYCLE_TONE[project.status as keyof typeof LIFECYCLE_TONE] ?? "muted"}>
              {labelFor(LIFECYCLE_STATUSES, project.status)}
            </Badge>
            <Badge
              tone={STATUS_TONE[project.publicationStatus as keyof typeof STATUS_TONE] ?? "muted"}
              dot
            >
              {labelFor(PUBLICATION_STATUSES, project.publicationStatus)}
            </Badge>
            {detail.category && (
              <Link
                href={`/explore?category=${detail.category.slug}`}
                className="rounded"
              >
                <Badge tone="muted">{detail.category.name}</Badge>
              </Link>
            )}
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gh-fg-default sm:text-4xl">
                {project.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-gh-fg-muted sm:text-base">
                {project.shortDescription}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-gh-fg-muted">
                <span className="flex items-center gap-2">
                  <Avatar name={owner.name} src={owner.avatarUrl} size="sm" />
                  {owner.username ? (
                    <Link
                      href={`/students/${owner.username}`}
                      className="font-medium text-gh-fg-default hover:text-gh-accent"
                    >
                      {owner.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-gh-fg-default">
                      {owner.name}
                    </span>
                  )}
                  {members.length > 1 && (
                    <span className="text-gh-fg-subtle">
                      &amp; {members.length - 1} teammate
                      {members.length > 2 ? "s" : ""}
                    </span>
                  )}
                </span>

                <span className="flex items-center gap-1.5" title="Published">
                  <Icon name="event" size={15} />
                  {formatDate(project.publishedAt ?? project.createdAt)}
                </span>

                <span className="flex items-center gap-1.5" title="Views">
                  <Icon name="visibility" size={15} />
                  {project.viewCount.toLocaleString()} views
                </span>

                <LikeButton
                  slug={project.slug}
                  signedIn={Boolean(user)}
                  initialLiked={likedByViewer}
                  initialCount={project.likeCount}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-btn-bg px-3 py-2 text-xs font-medium text-gh-fg-default transition-colors hover:bg-gh-btn-hover"
                >
                  <Icon name={link.icon} size={16} tone="accent" />
                  {link.label}
                </a>
              ))}

              {canEdit && (
                <LinkButton
                  href={`/dashboard/projects/${project.id}/edit`}
                  variant="default"
                  leadingIcon="edit"
                >
                  Edit
                </LinkButton>
              )}

              <LinkButton
                href={`/report/${project.slug}`}
                variant="ghost"
                leadingIcon="flag"
              >
                Report
              </LinkButton>
            </div>
          </div>

          {/* Owner-only review state */}
          {(isOwner || canModerate) &&
            project.publicationStatus !== "published" && (
              <div className="mt-6">
                <Alert
                  tone={
                    project.publicationStatus === "rejected"
                      ? "danger"
                      : project.publicationStatus === "approved"
                        ? "success"
                        : "attention"
                  }
                  title={`This project is ${labelFor(
                    PUBLICATION_STATUSES,
                    project.publicationStatus,
                  ).toLowerCase()}`}
                >
                  {project.reviewNote
                    ? project.reviewNote
                    : "It is only visible to you and the reviewers until it is published."}
                </Alert>
              </div>
            )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Cover + gallery                                                   */}
      {/* ---------------------------------------------------------------- */}
      {(project.coverImage || images.length > 0) && (
        <section className="border-b border-gh-border-muted">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            {project.coverImage && (
              <figure className="relative aspect-[16/7] w-full overflow-hidden rounded-lg border border-gh-border bg-gh-inset">
                <Image
                  src={project.coverImage}
                  alt={`Cover artwork for ${project.title}`}
                  fill
                  priority
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  className="object-cover"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-gh-inset via-gh-inset/25 to-transparent"
                />
                <figcaption className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-4 sm:p-6">
                  <div className="flex items-center gap-3">
                    <AvatarStack
                      people={members.map((member) => ({
                        id: member.id,
                        name: member.name,
                        avatarUrl: member.avatarUrl,
                      }))}
                    />
                    <div>
                      <p className="text-sm font-medium text-gh-fg-default">
                        {members.length} student
                        {members.length === 1 ? "" : "s"}
                      </p>
                      <p className="font-mono text-xs text-gh-fg-muted">
                        {detail.department?.code ?? "Campus"} ·{" "}
                        {detail.academicYear ?? "Archive"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {technologies.slice(0, 5).map((technology) => (
                      <TechTag
                        key={technology.id}
                        name={technology.name}
                        slug={technology.slug}
                        icon={technology.icon}
                        tone="accent"
                      />
                    ))}
                  </div>
                </figcaption>
              </figure>
            )}

            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.slice(0, 8).map((image) => (
                  <a
                    key={image.id}
                    href={image.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block aspect-[16/10] overflow-hidden rounded-md border border-gh-border bg-gh-inset"
                    aria-label={image.alt ?? `Open image for ${project.title}`}
                  >
                    <Image
                      src={image.path}
                      alt={image.alt ?? `${project.title} screenshot`}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {image.caption && (
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gh-inset/85 px-2 py-1 font-mono text-[11px] text-gh-fg-muted">
                        {image.caption}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Body                                                              */}
      {/* ---------------------------------------------------------------- */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            {(project.description || sections.length === 0) && (
              <section aria-labelledby="about-heading">
                <h2
                  id="about-heading"
                  className="mb-3 border-b border-gh-border pb-2 text-lg font-semibold text-gh-fg-default"
                >
                  About
                </h2>
                {project.description ? (
                  <Markdown>{project.description}</Markdown>
                ) : (
                  <EmptyState
                    icon="description"
                    title="No write-up yet"
                    description="The team documented the essentials above — a longer write-up may come later."
                    compact
                  />
                )}
              </section>
            )}

            {sections.length > 0 && (
              <article className="space-y-8">
                {sections.map((section) => (
                  <section
                    key={section.id}
                    id={`section-${section.key}`}
                    className="scroll-mt-24"
                  >
                    <h2 className="mb-3 border-b border-gh-border pb-2 text-lg font-semibold text-gh-fg-default">
                      {section.title ??
                        SECTION_LABELS.get(section.key) ??
                        "Notes"}
                    </h2>
                    <Markdown>{section.content ?? ""}</Markdown>
                  </section>
                ))}
              </article>
            )}

            {/* Related */}
            <section aria-labelledby="related-heading">
              <h2
                id="related-heading"
                className="mb-4 border-b border-gh-border pb-2 text-lg font-semibold text-gh-fg-default"
              >
                Related in the archive
              </h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    href={`/projects/${item.slug}`}
                    className="group rounded-lg border border-gh-border bg-gh-card p-4 transition-all hover:border-gh-fg-subtle"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-wider text-gh-accent">
                      {item.category?.name ?? item.department?.name ?? "Project"}
                    </p>
                    <h3 className="mt-1.5 text-sm font-semibold text-gh-fg-default transition-colors group-hover:text-gh-accent">
                      {item.title}
                    </h3>
                    <p className="clamp-2 mt-1.5 text-xs leading-relaxed text-gh-fg-muted">
                      {item.shortDescription}
                    </p>
                    <p className="mt-3 flex items-center gap-3 font-mono text-[11px] text-gh-fg-muted">
                      <span className="flex items-center gap-1">
                        <Icon name="visibility" size={13} />
                        {item.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="star" size={13} tone="attention" />
                        {item.likeCount}
                      </span>
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-5 self-start lg:sticky lg:top-24">
            {sections.length > 1 && (
              <nav
                aria-label="On this page"
                className="rounded-lg border border-gh-border bg-gh-card"
              >
                <p className="border-b border-gh-border bg-gh-subtle px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
                  On this page
                </p>
                <ul className="space-y-0.5 p-3">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#section-${section.key}`}
                        className="block rounded px-2 py-1.5 text-xs text-gh-fg-muted transition-colors hover:bg-gh-btn-hover hover:text-gh-fg-default"
                      >
                        {section.title ??
                          SECTION_LABELS.get(section.key) ??
                          "Notes"}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <div className="rounded-lg border border-gh-border bg-gh-card">
              <p className="border-b border-gh-border bg-gh-subtle px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
                Project details
              </p>
              <dl className="divide-y divide-gh-border-muted">
                {meta.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start justify-between gap-3 px-4 py-2.5"
                  >
                    <dt className="flex items-center gap-1.5 text-xs text-gh-fg-muted">
                      <Icon name={item.icon} size={14} />
                      {item.label}
                    </dt>
                    <dd className="text-right font-mono text-xs text-gh-fg-default">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-lg border border-gh-border bg-gh-card">
              <p className="border-b border-gh-border bg-gh-subtle px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
                Team · {members.length}
              </p>
              <ul className="space-y-3 p-4">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center gap-3">
                    <Avatar name={member.name} src={member.avatarUrl} size="md" verified={member.isOwner} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gh-fg-default">
                        {member.username ? (
                          <Link
                            href={`/students/${member.username}`}
                            className="rounded hover:text-gh-accent"
                          >
                            {member.name}
                          </Link>
                        ) : (
                          member.name
                        )}
                      </p>
                      <p className="truncate font-mono text-[11px] text-gh-fg-muted">
                        {member.role}
                        {member.departmentCode ? ` · ${member.departmentCode}` : ""}
                        {member.batch ? ` · Batch '${String(member.batch).slice(-2)}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-gh-border bg-gh-card p-4">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
                Tech stack
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {technologies.length > 0 ? (
                  technologies.map((technology) => (
                    <TechTag
                      key={technology.id}
                      name={technology.name}
                      slug={technology.slug}
                      icon={technology.icon}
                    />
                  ))
                ) : (
                  <p className="text-xs text-gh-fg-subtle">
                    No stack recorded yet.
                  </p>
                )}
              </div>
            </div>

            {/* Real GitHub data — fetched live, never faked. */}
            {repoRef && (
              <div className="rounded-lg border border-gh-border bg-gh-card">
                <p className="border-b border-gh-border bg-gh-subtle px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
                  GitHub repository
                </p>
                <div className="space-y-3 p-4">
                  <a
                    href={
                      repoMeta?.available ? repoMeta.htmlUrl : project.githubUrl!
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-medium text-gh-fg-default transition-colors hover:text-gh-accent"
                  >
                    <Icon name="fork" size={16} tone="accent" />
                    <span className="truncate">
                      {repoMeta?.available
                        ? repoMeta.fullName
                        : `${repoRef.owner}/${repoRef.repo}`}
                    </span>
                    <Icon
                      name="open_in_new"
                      size={13}
                      className="shrink-0 text-gh-fg-subtle"
                    />
                  </a>

                  {repoMeta?.available ? (
                    <>
                      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-gh-fg-muted">
                        <span className="flex items-center gap-1">
                          <Icon name="star" size={12} tone="attention" />
                          {repoMeta.stargazersCount.toLocaleString()} stars
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon name="fork" size={12} />
                          {repoMeta.forksCount.toLocaleString()} forks
                        </span>
                        {repoMeta.pushedAt && (
                          <span>
                            Updated {relativeTime(new Date(repoMeta.pushedAt))}
                          </span>
                        )}
                      </p>

                      {languageBreakdown.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="font-mono text-[11px] text-gh-fg-subtle">
                            Languages
                          </p>
                          {languageBreakdown.map((language) => (
                            <div
                              key={language.name}
                              className="flex items-center gap-2 text-[11px]"
                            >
                              <span className="w-24 shrink-0 truncate text-gh-fg-muted">
                                {language.name}
                              </span>
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gh-inset">
                                <span
                                  className="block h-full rounded-full bg-gh-accent"
                                  style={{ width: `${language.percent}%` }}
                                />
                              </span>
                              <span className="w-8 shrink-0 text-right font-mono text-gh-fg-subtle">
                                {language.percent}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs leading-relaxed text-gh-fg-muted">
                      {repoMeta?.reason === "not_found"
                        ? "Repository data unavailable — it may be private or removed."
                        : repoMeta?.reason === "rate_limited"
                          ? "GitHub's API rate limit was reached — stats are unavailable right now."
                          : "GitHub is unreachable right now — stats are unavailable."}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-gh-border bg-gh-card p-4">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
                Share &amp; cite
              </p>
              <p className="mt-2 text-xs leading-relaxed text-gh-fg-muted">
                {truncate(project.shortDescription, 90)}
              </p>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-gh-fg-subtle">
                <span className="flex items-center gap-1">
                  <Icon name="link" size={13} />
                  {SITE.name.toLowerCase()}/{project.slug}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="history" size={13} />
                  Updated {relativeTime(project.updatedAt)}
                </span>
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* CTA */}
      <section className="border-t border-gh-border-muted">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Eyebrow>Contribute</Eyebrow>
            <h2 className="text-xl font-semibold text-gh-fg-default">
              Built something worth sharing?
            </h2>
            <p className="mt-1 text-sm text-gh-fg-muted">
              Document your architecture and put your work in front of the campus.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton
              href="/explore"
              variant="default"
              leadingIcon="arrow_back"
            >
              Back to explore
            </LinkButton>
            <LinkButton
              href="/dashboard/projects/new"
              variant="primary"
              leadingIcon="add_circle"
            >
              Submit your project
            </LinkButton>
          </div>
        </div>
      </section>
    </div>
  );
}
