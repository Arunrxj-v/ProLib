import Link from "next/link";

import { Section } from "@/components/home/Section";
import { ProjectCard } from "@/components/project/ProjectCard";
import { StudentCard } from "@/components/student/StudentCard";
import { LinkButton } from "@/components/ui/Button";
import { Eyebrow, TechTag } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/Panel";
import { TabLinks } from "@/components/ui/Navigation";
import type { ProjectCardData } from "@/lib/data/projects";
import {
  getRecentProjects,
  getShowcaseProjects,
  listProjects,
} from "@/lib/data/projects";
import { listStudents } from "@/lib/data/students";
import { PROJECT_TYPES } from "@/lib/constants";
import { cn, compactNumber, relativeTime } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Featured projects                                                    */
/* ------------------------------------------------------------------ */

export async function FeaturedSection() {
  const projects = await getShowcaseProjects(3);

  return (
    <Section id="featured-projects">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>Curated Engineering</Eyebrow>
          <h2 className="text-2xl font-semibold text-gh-fg-default">
            Featured Student Projects
          </h2>
        </div>
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gh-accent hover:underline"
        >
          <span>View all projects</span>
          <Icon name="north_east" size={16} />
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon="folder_special"
          title="No published projects yet"
          description="The library is empty. Be the first student to document a project and put it in front of the campus."
          action={
            <LinkButton href="/dashboard/projects/new" variant="primary" leadingIcon="add">
              Add a project
            </LinkButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Trending / recent / open source                                      */
/* ------------------------------------------------------------------ */

const FEED_TABS = [
  { value: "trending", label: "Trending This Week", href: "/?feed=trending#active-builds" },
  { value: "recent", label: "Recently Added", href: "/?feed=recent#active-builds" },
  { value: "opensource", label: "Top Open Source", href: "/?feed=opensource#active-builds" },
];

function TrendCard({ project, feed }: { project: ProjectCardData; feed: string }) {
  const type = PROJECT_TYPES.find((item) => item.value === project.projectType);
  const owner = project.owner;

  return (
    <article className="group flex flex-col justify-between rounded-lg border border-gh-border bg-gh-card p-5 transition-all hover:border-gh-fg-subtle">
      <div>
        <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs text-gh-fg-muted">
          <span
            className={cn(
              "flex items-center gap-1.5",
              feed === "trending" ? "text-gh-attention" : "text-gh-success",
            )}
          >
            <Icon
              name={feed === "trending" ? "trending_up" : feed === "recent" ? "schedule" : "fork_right"}
              size={15}
            />
            <span className="truncate">{type?.label ?? "Project"}</span>
          </span>
          <span className="shrink-0">
            Updated {relativeTime(project.publishedAt ?? project.createdAt)}
          </span>
        </div>

        <h4 className="mb-2 text-base font-semibold text-gh-fg-default transition-colors group-hover:text-gh-accent">
          <Link href={`/projects/${project.slug}`} className="rounded">
            {project.title}
          </Link>
        </h4>

        <p className="clamp-3 mb-4 text-xs leading-relaxed text-gh-fg-muted">
          {project.shortDescription}
        </p>

        <div className="mb-5 flex flex-wrap gap-1.5">
          {project.technologies.slice(0, 3).map((technology) => (
            <TechTag
              key={technology.slug}
              name={technology.name}
              slug={technology.slug}
              tone="muted"
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gh-border pt-3 font-mono text-xs text-gh-fg-muted">
        <span className="truncate font-sans font-medium text-gh-fg-default">
          {owner ? `${owner.name.split(" ")[0]} ${owner.name.split(" ").slice(1).join(" ")}`.trim() : "Campus team"}
          {(owner?.departmentCode || owner?.batch) && (
            <span className="font-mono text-gh-fg-muted">
              {" "}
              ({owner?.departmentCode ?? "Campus"}
              {owner?.batch ? ` '${String(owner.batch).slice(-2)}` : ""})
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1">
            <Icon name="visibility" size={15} />
            {compactNumber(project.viewCount)}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="thumb_up" size={15} tone="attention" />
            {compactNumber(project.likeCount)}
          </span>
        </span>
      </div>
    </article>
  );
}

export async function TrendingSection({ feed }: { feed: string }) {
  const active = FEED_TABS.some((tab) => tab.value === feed) ? feed : "trending";

  const projects =
    active === "recent"
      ? await getRecentProjects(3)
      : await listProjects({
          sort: active === "trending" ? "trending" : "popular",
          openSource: active === "opensource",
          pageSize: 3,
        }).then((result) => result.items);

  return (
    <Section id="active-builds">
      <div className="mb-8 flex flex-col gap-4 border-b border-gh-border pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Eyebrow>Campus Velocity</Eyebrow>
          <h2 className="text-2xl font-semibold text-gh-fg-default">
            Trending &amp; Active Builds
          </h2>
        </div>
        <TabLinks tabs={FEED_TABS} active={active} label="Project feed" />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon="trending_up"
          title="Nothing to show in this feed yet"
          description="Once projects are published, activity across the campus shows up here."
          compact
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {projects.map((project) => (
            <TrendCard key={project.id} project={project} feed={active} />
          ))}
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Student builders                                                     */
/* ------------------------------------------------------------------ */

export async function BuildersSection() {
  const { items: students } = await listStudents({ pageSize: 3 });

  return (
    <Section>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>Peer Network</Eyebrow>
          <h2 className="text-2xl font-semibold text-gh-fg-default">
            Meet the Student Builders
          </h2>
        </div>
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gh-accent hover:underline"
        >
          <span>Search builder directory</span>
          <Icon name="arrow_forward" size={16} />
        </Link>
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon="group"
          title="No student profiles yet"
          description="Verified students appear here once they create a profile."
          compact
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {students.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Contribution CTA                                                     */
/* ------------------------------------------------------------------ */

export function ContributeCta() {
  return (
    <section className="w-full py-16" id="submit">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="rounded-lg border border-gh-border bg-gh-card p-8 md:p-12">
          <div className="max-w-3xl space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-gh-border bg-gh-inset px-2.5 py-0.5 font-mono text-xs font-medium text-gh-accent">
              <Icon name="auto_stories" size={14} />
              <span>OPEN ACADEMIC ARCHIVE</span>
            </span>

            <h2 className="text-3xl font-bold tracking-tight text-gh-fg-default md:text-4xl">
              Built something worth sharing?
            </h2>

            <p className="text-sm leading-relaxed text-gh-fg-muted md:text-base">
              Don&apos;t let your semester project rot in a zip file. Document your
              architecture, link your git repository, and put your work directly in
              front of students, faculty evaluators, and prospective technical
              recruiters.
            </p>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <LinkButton
                href="/dashboard/projects/new"
                variant="primary"
                size="lg"
                leadingIcon="add_circle"
              >
                Submit Your Project
              </LinkButton>
              <LinkButton
                href="/explore"
                variant="default"
                size="lg"
                leadingIcon="description"
              >
                Browse the archive
              </LinkButton>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-4 font-mono text-xs text-gh-fg-muted">
              {[
                "Markdown & README import",
                "Gallery & architecture diagrams",
                "Team members with real profiles",
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <Icon name="check_circle" size={16} tone="success" />
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
