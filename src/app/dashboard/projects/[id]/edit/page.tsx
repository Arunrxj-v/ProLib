import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteProject } from "@/components/dashboard/DeleteProject";
import { GalleryEditor } from "@/components/dashboard/GalleryEditor";
import { ProjectActions } from "@/components/dashboard/ProjectActions";
import { ProjectEditForm } from "@/components/dashboard/ProjectEditForm";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { TeamManager } from "@/components/dashboard/TeamManager";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Alert, Panel, PanelHeader } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Tag";
import { requireUser } from "@/lib/auth/guards";
import { PROJECT_SECTION_KEYS, SITE } from "@/lib/constants";
import { getMyProject } from "@/lib/data/myProjects";
import { isModerationEnabled } from "@/lib/settings";
import {
  getAcademicYears,
  getCategories,
  getDepartments,
  getSemesters,
  getTechnologyOptions,
} from "@/lib/data/taxonomy";
import { formatDate, relativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Edit project",
  description: "Update your project, team, stack and gallery.",
};

export default async function EditProjectPage({
  params,
  searchParams,
}: PageProps<"/dashboard/projects/[id]/edit">) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/dashboard/projects/${id}/edit`);

  const detail = await getMyProject(id, user.id);
  if (!detail) notFound();

  const [departments, categories, years, semesters, technologies] =
    await Promise.all([
      getDepartments(),
      getCategories(),
      getAcademicYears(),
      getSemesters(),
      getTechnologyOptions(),
    ]);

  const moderation = await isModerationEnabled();
  const { project } = detail;
  const isPublic = ["approved", "published"].includes(project.publicationStatus);
  const sections = new Map(detail.sections.map((item) => [item.key, item]));

  const stats = [
    { icon: "visibility", label: "Views", value: project.viewCount },
    { icon: "favorite", label: "Likes", value: project.likeCount },
    { icon: "group", label: "Team", value: detail.members.length },
    { icon: "photo_library", label: "Gallery", value: detail.images.length },
  ];

  return (
    <div className="w-full py-8 sm:py-10">
      {query.created === "1" && query.published === "live" && (
        <Alert tone="success" className="mb-6" title="Published">
          Your project is live in the library. Add screenshots or team members
          whenever you like.
        </Alert>
      )}
      {query.created === "1" && query.published === "review" && (
        <Alert tone="success" className="mb-6" title="Submitted for review">
          A moderator will look it over, then it goes live in the library.
        </Alert>
      )}
      {query.created === "1" && !query.published && (
        <Alert tone="success" className="mb-6" title="Project created">
          Add screenshots and team members below, then publish when you are
          ready.
        </Alert>
      )}
      {query.saved === "1" && (
        <Alert tone="success" className="mb-6">
          Changes saved.
        </Alert>
      )}
      {project.publicationStatus === "rejected" && project.reviewNote && (
        <Alert tone="danger" className="mb-6" title="Changes requested">
          {project.reviewNote}
        </Alert>
      )}
      {["submitted", "in_review"].includes(project.publicationStatus) && (
        <Alert tone="accent" className="mb-6" title="In the review queue">
          A moderator is looking at this project. You can still edit it — the
          version they see updates as you save.
        </Alert>
      )}

      {/* Header */}
      <header className="mb-6 border-b border-gh-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Eyebrow>Editing</Eyebrow>
            <h1 className="text-2xl font-bold tracking-tight text-gh-fg-default sm:text-3xl">
              {project.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gh-fg-muted">
              {project.shortDescription}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={project.publicationStatus} />
              <span className="font-mono text-[11px] text-gh-fg-subtle">
                /{project.slug}
              </span>
              <span className="font-mono text-[11px] text-gh-fg-subtle">
                Updated {relativeTime(project.updatedAt)}
              </span>
              <span className="font-mono text-[11px] text-gh-fg-subtle">
                Created {formatDate(project.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isPublic && (
              <LinkButton
                href={`/projects/${project.slug}`}
                variant="ghost"
                leadingIcon="open_in_new"
              >
                View public page
              </LinkButton>
            )}
            <ProjectActions
              projectId={project.id}
              status={project.publicationStatus}
              moderation={moderation}
              size="md"
            />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-gh-border bg-gh-card px-3 py-2.5"
            >
              <dt className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-gh-fg-subtle">
                <Icon name={stat.icon} size={13} />
                {stat.label}
              </dt>
              <dd className="mt-0.5 text-lg font-semibold text-gh-fg-default">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <ProjectEditForm
            detail={detail}
            departments={departments.map((item) => ({ id: item.id, name: item.name }))}
            categories={categories.map((item) => ({ id: item.id, name: item.name }))}
            years={years.map((item) => ({ id: item.id, name: item.label }))}
            semesters={semesters.map((item) => ({ id: item.id, name: item.label }))}
            technologies={technologies.map((item) => ({
              id: item.id,
              name: item.name,
              slug: item.slug,
              icon: item.icon,
              kind: item.kind,
            }))}
            sectionValues={Object.fromEntries(
              PROJECT_SECTION_KEYS.map((item) => [
                item.value,
                sections.get(item.value)?.content ?? "",
              ]),
            )}
          />

          {/* Gallery */}
          <Panel padded={false}>
            <PanelHeader
              title="Gallery"
              description="Screenshots and diagrams shown on the public page."
            />
            <div className="p-5">
              <GalleryEditor
                projectId={project.id}
                images={detail.images}
                title={project.title}
              />
            </div>
          </Panel>
        </div>

        <aside className="space-y-6">
          <TeamManager
            projectId={project.id}
            members={detail.members}
            currentUser={user.name}
          />

          <Panel padded={false}>
            <PanelHeader title="Project record" />
            <dl className="divide-y divide-gh-border-muted text-xs">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-gh-fg-muted">Owner</dt>
                <dd className="truncate text-gh-fg-default">
                  <Link
                    href={`/students/${user.username ?? ""}`}
                    className="hover:text-gh-accent"
                  >
                    {user.name}
                  </Link>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-gh-fg-muted">Site</dt>
                <dd className="font-mono text-gh-fg-subtle">
                  {SITE.name.toLowerCase()}/{project.slug}
                </dd>
              </div>
            </dl>
          </Panel>

          <DeleteProject projectId={project.id} title={project.title} />
        </aside>
      </div>
    </div>
  );
}
