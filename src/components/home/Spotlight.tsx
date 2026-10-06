import Image from "next/image";
import Link from "next/link";

import { Section } from "@/components/home/Section";
import { AvatarStack } from "@/components/ui/Avatar";
import { Badge, Eyebrow, TechTag } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/Panel";
import { LinkButton } from "@/components/ui/Button";
import type { ProjectCardData } from "@/lib/data/projects";
import { getSpotlightProjects } from "@/lib/data/projects";
import { PROJECT_TYPES } from "@/lib/constants";
import { compactNumber, initials } from "@/lib/utils";

function typeLabel(value: string) {
  return PROJECT_TYPES.find((item) => item.value === value)?.label ?? "Project";
}

function Meta({ project }: { project: ProjectCardData }) {
  return (
    <>
      {project.technologies.slice(0, 4).map((technology) => (
        <TechTag
          key={technology.slug}
          name={technology.name}
          slug={technology.slug}
          icon={technology.icon}
          tone="muted"
        />
      ))}
    </>
  );
}

/** Large hero card of the bento grid. */
function SpotlightLead({ project }: { project: ProjectCardData }) {
  const ownerName = project.owner?.name ?? "Campus team";

  return (
    <article className="group flex flex-col justify-between rounded-lg border border-gh-border bg-gh-card p-6 transition-all hover:border-gh-fg-subtle">
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <Badge tone="success">FEATURED CAPSTONE</Badge>
          <span className="flex items-center gap-1.5 font-mono text-xs text-gh-fg-muted">
            <Icon name="verified" size={16} tone="success" />
            Faculty Approved
          </span>
        </div>

        <h3 className="mb-2 text-xl font-semibold text-gh-fg-default transition-colors group-hover:text-gh-accent">
          <Link href={`/projects/${project.slug}`} className="rounded">
            {project.title}
          </Link>
        </h3>

        <p className="clamp-2 mb-6 text-sm leading-relaxed text-gh-fg-muted">
          {project.shortDescription}
        </p>

        <div className="relative mb-6 h-56 w-full overflow-hidden rounded-md border border-gh-border bg-gh-inset">
          {project.coverImage ? (
            <Image
              src={project.coverImage}
              alt={`Preview of ${project.title}`}
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <Icon name="deployed_code" size={32} tone="muted" />
            </span>
          )}
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-gh-inset/95 via-gh-inset/40 to-transparent p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-gh-border bg-gh-subtle font-mono text-xs font-bold text-gh-accent">
                {initials(ownerName)}
              </span>
              <div>
                <div className="text-sm font-semibold text-gh-fg-default">
                  {compactNumber(project.viewCount)} views ·{" "}
                  {compactNumber(project.likeCount)} likes
                </div>
                <div className="text-xs text-gh-fg-muted">
                  {project.teamSize} builders ·{" "}
                  {project.department?.name ?? "Interdisciplinary"} ·{" "}
                  {project.academicYear ?? "Ongoing"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gh-border pt-4">
        <div className="flex flex-wrap gap-1.5">
          <Meta project={project} />
        </div>
        <div className="flex items-center gap-3">
          <AvatarStack people={project.members} />
          <span className="text-xs text-gh-fg-muted">
            {ownerName}
            {project.teamSize > 1 ? " & Team" : ""}
          </span>
        </div>
      </div>
    </article>
  );
}

/** Compact card used in the right-hand column of the bento. */
function SpotlightItem({ project }: { project: ProjectCardData }) {
  return (
    <article className="group flex flex-1 flex-col justify-between rounded-lg border border-gh-border bg-gh-card p-5 transition-all hover:border-gh-fg-subtle">
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <Badge tone="accent">{project.category?.name ?? typeLabel(project.projectType)}</Badge>
          <span className="truncate font-mono text-xs text-gh-fg-muted">
            {project.academicYear ?? "Campus"}
          </span>
        </div>

        <h4 className="mb-1.5 text-base font-semibold text-gh-fg-default transition-colors group-hover:text-gh-accent">
          <Link href={`/projects/${project.slug}`} className="rounded">
            {project.title}
          </Link>
        </h4>

        <p className="clamp-2 mb-3 text-xs leading-relaxed text-gh-fg-muted">
          {project.shortDescription}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gh-border pt-3">
        <div className="flex min-w-0 gap-1.5">
          {project.technologies.slice(0, 3).map((technology) => (
            <TechTag
              key={technology.slug}
              name={technology.name}
              slug={technology.slug}
              tone="muted"
            />
          ))}
        </div>
        <span className="shrink-0 text-xs font-medium text-gh-accent">
          {project.owner
            ? project.owner.username
              ? `${project.owner.name.split(" ")[0]} (${project.owner.departmentCode ?? "Campus"})`
              : project.owner.name
            : "Campus team"}
        </span>
      </div>
    </article>
  );
}

export async function SpotlightSection() {
  const projects = await getSpotlightProjects(3);
  const [lead, ...rest] = projects;

  return (
    <Section>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>Live Campus Feed</Eyebrow>
          <h2 className="text-2xl font-semibold text-gh-fg-default">
            Spotlight Capstones
          </h2>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-gh-fg-muted">
          <span className="h-2 w-2 rounded-full bg-gh-success" />
          <span>Syncing with university git mirrors</span>
        </div>
      </div>

      {!lead ? (
        <EmptyState
          icon="auto_stories"
          title="The spotlight is waiting for its first capstone"
          description="Once a project is submitted and approved, it appears here for the whole campus to see."
          action={
            <LinkButton href="/dashboard/projects/new" variant="primary" leadingIcon="add">
              Submit the first project
            </LinkButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SpotlightLead project={lead} />
          </div>
          <div className="flex flex-col gap-5 lg:col-span-5">
            {rest.length > 0 ? (
              rest.map((project) => <SpotlightItem key={project.id} project={project} />)
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gh-border bg-gh-card p-6 text-center text-sm text-gh-fg-muted">
                More spotlight slots open as projects are approved.
              </div>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
