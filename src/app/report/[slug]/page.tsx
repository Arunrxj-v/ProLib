import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportForm } from "@/components/report/ReportForm";
import { Icon } from "@/components/ui/Icon";
import { Alert } from "@/components/ui/Panel";
import { Badge, Eyebrow } from "@/components/ui/Tag";
import { getCurrentUser } from "@/lib/auth/session";
import { PUBLICATION_STATUSES, SITE } from "@/lib/constants";
import { getReportableProject } from "@/lib/data/reporting";
import { truncate } from "@/lib/utils";

type Params = { slug: string };

async function load(slug: string) {
  const [project, user] = await Promise.all([
    getReportableProject(slug),
    getCurrentUser(),
  ]);
  return { project, user };
}

/**
 * The visibility rule lives in `getReportableProject`, so a project the viewer
 * may not see is indistinguishable from one that does not exist — `notFound()`
 * renders the same 404 either way.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { project } = await load(slug);
  if (!project) return { title: "Project not found" };

  return {
    title: `Report ${project.title}`,
    description: `Flag ${project.title} for review by the ${SITE.name} moderators.`,
    robots: { index: false, follow: false },
  };
}

export default async function ReportPage({ params }: PageProps<"/report/[slug]">) {
  const { slug } = await params;
  const { project, user } = await load(slug);
  if (!project) notFound();

  const statusLabel =
    PUBLICATION_STATUSES.find((item) => item.value === project.publicationStatus)
      ?.label ?? project.publicationStatus;
  const isOwner = user?.id === project.ownerId;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex flex-wrap items-center gap-1.5 font-mono text-xs text-gh-fg-muted"
      >
        <Link href="/explore" className="hover:text-gh-accent">
          Explore
        </Link>
        <Icon name="chevron_right" size={14} />
        <Link href={`/projects/${project.slug}`} className="hover:text-gh-accent">
          {project.title}
        </Link>
        <Icon name="chevron_right" size={14} />
        <span className="text-gh-fg-default">Report</span>
      </nav>

      <header className="mb-6 border-b border-gh-border-muted pb-6">
        <Eyebrow>Moderation</Eyebrow>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gh-fg-default sm:text-3xl">
          Report this project
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gh-fg-muted">
          Tell the moderators what is wrong with{" "}
          <span className="font-medium text-gh-fg-default">{project.title}</span>.
          Reports are private: the team never sees who filed one, and nothing on
          this page changes the project.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="accent">Report</Badge>
          <Badge tone="muted">{statusLabel}</Badge>
          <span className="font-mono text-[11px] text-gh-fg-subtle">
            /{project.slug}
          </span>
        </div>
      </header>

      <div className="space-y-5">
        {isOwner && (
          <Alert tone="attention" title="This is your own project">
            You can report someone else&apos;s work the same way. To change your
            own project, edit it from the dashboard instead.
          </Alert>
        )}

        {!user && (
          <Alert tone="accent" title="Reporting anonymously">
            You do not need an account. Reports are rate limited and duplicate
            reports of the same problem are merged into the one that is already
            open.
          </Alert>
        )}

        <ReportForm
          slug={project.slug}
          title={project.title}
          signedIn={Boolean(user)}
        />

        <section
          aria-labelledby="what-happens"
          className="rounded-lg border border-gh-border bg-gh-card p-5"
        >
          <h2
            id="what-happens"
            className="text-sm font-semibold text-gh-fg-default"
          >
            What happens next
          </h2>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-gh-fg-muted">
            <li className="flex gap-2">
              <Icon name="fact_check" size={14} tone="accent" />
              A moderator opens the project page alongside your report and
              decides whether it needs editing, unlisting or nothing at all.
            </li>
            <li className="flex gap-2">
              <Icon name="lock" size={14} tone="accent" />
              Your identity is never shown to the team — only the decision is
              recorded in the moderation log.
            </li>
            <li className="flex gap-2">
              <Icon name="mail" size={14} tone="accent" />
              For urgent issues — harassment, unsafe content or personal data —
              also tell your department administrator so it is handled outside
              the queue.
            </li>
          </ul>
        </section>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/projects/${project.slug}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-btn-bg px-3 py-2 text-xs font-medium text-gh-fg-default transition-colors hover:bg-gh-btn-hover"
          >
            <Icon name="arrow_back" size={16} />
            Back to the project
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-btn-bg px-3 py-2 text-xs font-medium text-gh-fg-default transition-colors hover:bg-gh-btn-hover"
          >
            <Icon name="explore" size={16} />
            Explore the library
          </Link>
        </div>

        <p className="text-xs text-gh-fg-subtle">
          {truncate(
            `${SITE.name} moderates student work before it appears in the library. False reports waste moderator time, so describe the problem as precisely as you can.`,
            240,
          )}
        </p>
      </div>
    </div>
  );
}
