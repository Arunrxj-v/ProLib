import Image from "next/image";
import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { Badge, TechTag } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";
import { withBase } from "@/lib/base-path";
import type { ProjectCardData } from "@/lib/data/projects";
import { LIFECYCLE_STATUSES, PROJECT_TYPES } from "@/lib/constants";
import { cn, compactNumber } from "@/lib/utils";

function labelFor(list: ReadonlyArray<{ value: string; label: string }>, value: string) {
  return list.find((item) => item.value === value)?.label ?? "Other";
}

const STATUS_TONE = {
  in_progress: "attention",
  completed: "success",
  archived: "muted",
} as const;

export type ProjectCardProps = {
  project: ProjectCardData;
  className?: string;
};

/**
 * The reusable project card from the supplied design.
 * Hierarchy: cover → title → one-line summary → tech → team → metrics.
 */
export function ProjectCard({ project, className }: ProjectCardProps) {
  const typeLabel = labelFor(PROJECT_TYPES, project.projectType);
  const statusLabel = labelFor(LIFECYCLE_STATUSES, project.status);
  const owner = project.owner;
  const ownerLabel = owner
    ? project.teamSize > 1
      ? `${owner.name} + ${project.teamSize - 1}`
      : owner.name
    : "Campus team";

  const metaLine = [
    owner?.departmentCode ?? project.department?.name?.slice(0, 3).toUpperCase() ?? null,
    project.academicYear ? `Batch '${project.academicYear.slice(-2)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border border-gh-border bg-gh-card transition-all hover:border-gh-fg-subtle",
        className,
      )}
    >
      {/* Cover */}
      <Link
        href={`/projects/${project.slug}`}
        tabIndex={-1}
        aria-hidden
        className="relative block aspect-[16/10] w-full overflow-hidden border-b border-gh-border bg-gh-inset"
      >
        {project.coverImage ? (
          <Image
            src={withBase(project.coverImage)}
            alt={`Cover screenshot of ${project.title}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-md border border-gh-border bg-gh-subtle">
              <Icon
                name={project.category?.icon ?? "deployed_code"}
                size={24}
                tone="muted"
              />
            </span>
          </span>
        )}

        <span className="absolute left-3 top-3">
          <Badge tone="accent" className="bg-gh-inset/90 backdrop-blur-sm">
            {typeLabel}
          </Badge>
        </span>

        {project.featured && (
          <span className="absolute right-3 top-3">
            <Badge tone="success" className="bg-gh-inset/90 backdrop-blur-sm" dot>
              Featured
            </Badge>
          </span>
        )}
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <h3 className="text-base font-semibold leading-tight text-gh-fg-default transition-colors group-hover:text-gh-accent">
              <Link href={`/projects/${project.slug}`} className="rounded">
                {project.title}
              </Link>
            </h3>
            <Icon
              name="verified"
              size={16}
              tone="success"
              title="Reviewed by faculty"
            />
          </div>

          <p className="clamp-2 mb-4 text-xs leading-relaxed text-gh-fg-muted">
            {project.shortDescription}
          </p>

          <div className="mb-5 flex flex-wrap gap-1.5">
            {project.technologies.slice(0, 4).map((technology) => (
              <TechTag
                key={technology.slug}
                name={technology.name}
                slug={technology.slug}
                icon={technology.icon}
                tone="muted"
              />
            ))}
            {project.technologies.length > 4 && (
              <span className="inline-flex items-center px-1 font-mono text-xs text-gh-fg-subtle">
                +{project.technologies.length - 4}
              </span>
            )}
          </div>
        </div>

        {/* Team + metrics */}
        <div className="space-y-3 border-t border-gh-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar name={owner?.name ?? "ProLib"} src={owner?.avatarUrl} size="sm" />
              <div className="min-w-0 text-left">
                <span className="block truncate text-xs font-medium leading-none text-gh-fg-default">
                  {owner ? (
                    owner.username ? (
                      <Link
                        href={`/students/${owner.username}`}
                        className="rounded hover:text-gh-accent"
                      >
                        {ownerLabel}
                      </Link>
                    ) : (
                      ownerLabel
                    )
                  ) : (
                    ownerLabel
                  )}
                </span>
                {metaLine && (
                  <span className="mt-0.5 block truncate font-mono text-[11px] leading-none text-gh-fg-muted">
                    {metaLine}
                  </span>
                )}
              </div>
            </div>

            <span
              className="flex shrink-0 items-center gap-1 font-mono text-xs text-gh-fg-muted"
              title={`${project.likeCount} likes`}
            >
              <Icon name="star" size={15} tone="attention" />
              {compactNumber(project.likeCount)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-3 text-gh-fg-muted">
              <span
                className="flex items-center gap-1"
                title={`${project.viewCount} views`}
              >
                <Icon name="visibility" size={15} />
                {compactNumber(project.viewCount)}
              </span>
              <Badge
                tone={STATUS_TONE[project.status as keyof typeof STATUS_TONE] ?? "muted"}
                className="px-2 py-0 text-[11px]"
              >
                {statusLabel}
              </Badge>
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open repository"
                  className="flex items-center gap-1 transition-colors hover:text-gh-fg-default"
                >
                  <Icon name="code" size={15} />
                  <span className="hidden sm:inline">Repo</span>
                </a>
              )}
            </div>

            <Link
              href={`/projects/${project.slug}`}
              className="inline-flex items-center gap-1 font-semibold text-gh-accent transition-transform group-hover:translate-x-0.5 hover:underline"
            >
              View Project
              <Icon name="arrow_forward" size={14} />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
