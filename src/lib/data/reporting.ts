import { getCurrentUser } from "@/lib/auth/session";
import { getProjectBySlug, getPublicStatuses } from "@/lib/data/projects";
import type { ProjectPublicationStatus } from "@/lib/constants";

export type ReportableProject = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  ownerId: string;
  publicationStatus: ProjectPublicationStatus;
};

/**
 * The one visibility rule for `/report/[slug]`.
 *
 * It mirrors `src/app/projects/[slug]/page.tsx`: a project can be reported by
 * exactly the people who can open its page — anonymous visitors see public
 * states only, owners see their own work, administrators see everything.
 * Anything else resolves to `null`, which the caller turns into a 404 so the
 * form never discloses that a hidden project exists.
 */
export async function getReportableProject(
  slug: string,
): Promise<ReportableProject | null> {
  const [detail, user] = await Promise.all([
    getProjectBySlug(slug),
    getCurrentUser(),
  ]);

  if (!detail) return null;

  const statuses = await getPublicStatuses();
  const { project } = detail;

  const canView =
    statuses.includes(project.publicationStatus) ||
    user?.id === project.ownerId ||
    user?.role === "admin";

  if (!canView) return null;

  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    shortDescription: project.shortDescription,
    ownerId: project.ownerId,
    publicationStatus: project.publicationStatus,
  };
}
