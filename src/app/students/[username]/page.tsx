import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectCard } from "@/components/project/ProjectCard";
import { Avatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/Panel";
import { Badge, Eyebrow, TechTag } from "@/components/ui/Tag";
import { SOCIAL_PROVIDERS, SITE } from "@/lib/constants";
import { listProjectsByIds } from "@/lib/data/projects";
import { getStudentByUsername, getStudentProjectIds } from "@/lib/data/students";
import { compactNumber } from "@/lib/utils";

function socialIcon(provider: string) {
  return SOCIAL_PROVIDERS.find((item) => item.value === provider)?.icon ?? "link";
}

function socialLabel(provider: string) {
  return SOCIAL_PROVIDERS.find((item) => item.value === provider)?.label ?? provider;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const student = await getStudentByUsername(username);
  // Thrown during the metadata phase so the route answers with a real 404
  // status code even though `loading.tsx` streams the page shell first.
  if (!student) notFound();

  const description =
    student.headline ??
    `${student.name} — student builder on ${SITE.name}.`;

  return {
    title: `${student.name} (@${student.username ?? username})`,
    description,
    alternates: { canonical: `/students/${student.username ?? username}` },
  };
}

export default async function StudentProfilePage({
  params,
}: PageProps<"/students/[username]">) {
  const { username } = await params;

  const student = await getStudentByUsername(username);
  if (!student) notFound();

  const projectIds = await getStudentProjectIds(student.id);
  const projects = await listProjectsByIds(projectIds);

  const meta = [
    student.department?.name ?? null,
    student.batch ? `Batch '${String(student.batch).slice(-2)}` : null,
    student.featured ? "Dean's List" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="w-full">
      {/* ---------------------------------------------------------------- */}
      {/* Profile hero                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <nav
            aria-label="Breadcrumb"
            className="mb-5 flex items-center gap-1.5 font-mono text-xs text-gh-fg-muted"
          >
            <Link href="/students" className="hover:text-gh-accent">
              Student directory
            </Link>
            <Icon name="chevron_right" size={14} />
            <span className="text-gh-fg-default">
              @{student.username ?? "profile"}
            </span>
          </nav>

          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <Avatar
              name={student.name}
              src={student.avatarUrl}
              size="xl"
              verified
              priority
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-gh-fg-default sm:text-3xl">
                  {student.name}
                </h1>
                <Icon
                  name="school"
                  size={18}
                  tone="success"
                  label="Verified campus student"
                />
                {student.featured && <Badge tone="attention">Dean&apos;s List</Badge>}
              </div>

              <p className="mt-1 font-mono text-sm text-gh-accent">
                @{student.username ?? "—"}
              </p>

              {student.headline && (
                <p className="mt-3 max-w-2xl text-sm leading-7 text-gh-fg-muted">
                  {student.headline}
                </p>
              )}

              {meta && (
                <p className="mt-3 flex items-center gap-1.5 font-mono text-xs text-gh-fg-muted">
                  <Icon name="corporate_fare" size={14} />
                  {meta}
                </p>
              )}

              {student.skills.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {student.skills.map((skill) => (
                    <TechTag key={skill} name={skill} />
                  ))}
                </div>
              )}

              {/* Socials render only when the student connected them. */}
              {(student.socials.length > 0 || student.githubUsername) && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {student.githubUsername && (
                    <a
                      href={`https://github.com/${student.githubUsername}`}
                      target="_blank"
                      rel="noopener noreferrer me"
                      className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-btn-bg px-2.5 py-1.5 text-xs font-medium text-gh-fg-default transition-colors hover:bg-gh-btn-hover"
                    >
                      <Icon name="code" size={15} tone="accent" />
                      GitHub
                    </a>
                  )}
                  {student.socials.map((social) => (
                    <a
                      key={social.provider}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer me"
                      className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-btn-bg px-2.5 py-1.5 text-xs font-medium text-gh-fg-muted transition-colors hover:bg-gh-btn-hover hover:text-gh-fg-default"
                      title={socialLabel(social.provider)}
                    >
                      <Icon name={socialIcon(social.provider)} size={15} />
                      {socialLabel(social.provider)}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            <dl className="grid grid-cols-2 gap-3 md:w-56">
              <div className="rounded-md border border-gh-border bg-gh-inset p-3">
                <dt className="font-mono text-[11px] uppercase tracking-wider text-gh-fg-muted">
                  Projects
                </dt>
                <dd className="mt-1 text-xl font-bold text-gh-accent">
                  {student.projectCount}
                </dd>
              </div>
              <div className="rounded-md border border-gh-border bg-gh-inset p-3">
                <dt className="font-mono text-[11px] uppercase tracking-wider text-gh-fg-muted">
                  Profile views
                </dt>
                <dd className="mt-1 text-xl font-bold text-gh-success">
                  {compactNumber(student.totalViews)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Body                                                              */}
      {/* ---------------------------------------------------------------- */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-labelledby="projects-heading" className="min-w-0">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-gh-border pb-3">
              <div>
                <Eyebrow>Portfolio</Eyebrow>
                <h2
                  id="projects-heading"
                  className="text-xl font-semibold text-gh-fg-default"
                >
                  Projects by {student.name.split(" ")[0]}
                </h2>
              </div>
              <Link
                href={`/explore?q=${encodeURIComponent(student.name)}`}
                className="text-xs font-semibold text-gh-accent hover:underline"
              >
                Search the archive
              </Link>
            </div>

            {projects.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="deployment"
                title="No published projects yet"
                description={`When ${student.name.split(" ")[0]} publishes a project through the review flow, it appears here.`}
                action={
                  <LinkButton href="/explore" variant="default">
                    Browse the archive
                  </LinkButton>
                }
              />
            )}
          </section>

          <aside className="space-y-5 self-start">
            {student.bio && (
              <div className="rounded-lg border border-gh-border bg-gh-card">
                <p className="border-b border-gh-border bg-gh-subtle px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
                  About
                </p>
                <p className="whitespace-pre-line p-4 text-sm leading-7 text-gh-fg-muted">
                  {student.bio}
                </p>
              </div>
            )}

            {student.skills.length > 0 && (
              <div className="rounded-lg border border-gh-border bg-gh-card">
                <p className="border-b border-gh-border bg-gh-subtle px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
                  Skills
                </p>
                <div className="flex flex-wrap gap-1.5 p-4">
                  {student.skills.map((skill) => (
                    <TechTag key={skill} name={skill} tone="accent" />
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-gh-border bg-gh-card">
              <p className="border-b border-gh-border bg-gh-subtle px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
                Profile
              </p>
              <dl className="divide-y divide-gh-border-muted text-xs">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <dt className="text-gh-fg-muted">Department</dt>
                  <dd className="font-mono text-gh-fg-default">
                    {student.department?.code ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <dt className="text-gh-fg-muted">Batch</dt>
                  <dd className="font-mono text-gh-fg-default">
                    {student.batch ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <dt className="text-gh-fg-muted">Status</dt>
                  <dd className="font-mono text-gh-success">Active</dd>
                </div>
              </dl>
            </div>

            <LinkButton
              href="/students"
              variant="default"
              leadingIcon="arrow_back"
              block
            >
              Back to the directory
            </LinkButton>
          </aside>
        </div>
      </div>
    </div>
  );
}
