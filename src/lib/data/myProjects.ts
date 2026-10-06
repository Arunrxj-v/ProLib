import "server-only";

import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  categories,
  departments,
  projectImages,
  projectMembers,
  projectSections,
  projectTechnologies,
  projects,
  socialLinks,
  technologies,
  users,
} from "@/lib/db/schema";
import type {
  ProjectLifecycleStatus,
  ProjectPublicationStatus,
  ProjectType,
} from "@/lib/constants";
import type { Paginated } from "./projects";

export type MyProject = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  publicationStatus: ProjectPublicationStatus;
  status: ProjectLifecycleStatus;
  projectType: ProjectType;
  coverImage: string | null;
  viewCount: number;
  likeCount: number;
  featured: boolean;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  department: { name: string; slug: string } | null;
  category: { name: string; slug: string; icon: string | null } | null;
  memberCount: number;
};

export type MyProjectQuery = {
  publicationStatus?: ProjectPublicationStatus | "all";
  page?: number;
  pageSize?: number;
};

const columns = {
  id: projects.id,
  slug: projects.slug,
  title: projects.title,
  shortDescription: projects.shortDescription,
  publicationStatus: projects.publicationStatus,
  status: projects.status,
  projectType: projects.projectType,
  coverImage: projects.coverImage,
  viewCount: projects.viewCount,
  likeCount: projects.likeCount,
  featured: projects.featured,
  reviewNote: projects.reviewNote,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
  submittedAt: projects.submittedAt,
  reviewedAt: projects.reviewedAt,
  publishedAt: projects.publishedAt,
  departmentName: departments.name,
  departmentSlug: departments.slug,
  categoryName: categories.name,
  categorySlug: categories.slug,
  categoryIcon: categories.icon,
  memberCount: sql<number>`(SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = ${projects.id})`.as(
    "member_count",
  ),
};

type RawRow = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  publicationStatus: ProjectPublicationStatus;
  status: ProjectLifecycleStatus;
  projectType: ProjectType;
  coverImage: string | null;
  viewCount: number;
  likeCount: number;
  featured: boolean;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  departmentName: string | null;
  departmentSlug: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  categoryIcon: string | null;
  memberCount: number;
};

function hydrate(row: RawRow): MyProject {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.shortDescription,
    publicationStatus: row.publicationStatus,
    status: row.status,
    projectType: row.projectType,
    coverImage: row.coverImage,
    viewCount: Number(row.viewCount ?? 0),
    likeCount: Number(row.likeCount ?? 0),
    featured: Boolean(row.featured),
    reviewNote: row.reviewNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    publishedAt: row.publishedAt,
    department:
      row.departmentName && row.departmentSlug
        ? { name: row.departmentName, slug: row.departmentSlug }
        : null,
    category:
      row.categoryName && row.categorySlug
        ? {
            name: row.categoryName,
            slug: row.categorySlug,
            icon: row.categoryIcon,
          }
        : null,
    memberCount: Number(row.memberCount ?? 0),
  };
}

/** One student's own projects — drafts and reviews included. */
export async function listMyProjects(
  ownerId: string,
  query: MyProjectQuery = {},
): Promise<Paginated<MyProject>> {
  const conditions: SQL[] = [eq(projects.ownerId, ownerId)];
  if (
    query.publicationStatus &&
    query.publicationStatus !== "all"
  ) {
    conditions.push(eq(projects.publicationStatus, query.publicationStatus));
  }

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(24, Math.max(1, query.pageSize ?? 10));

  const countRows = await db
    .select({ value: count() })
    .from(projects)
    .where(and(...conditions));
  const total = Number(countRows[0]?.value ?? 0);

  const rows = (await db
    .select(columns)
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .leftJoin(categories, eq(projects.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(projects.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)) as unknown as RawRow[];

  return {
    items: rows.map(hydrate),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Status tally for the dashboard overview. */
export async function countMyProjects(ownerId: string) {
  const rows = await db
    .select({
      status: projects.publicationStatus,
      value: count(),
    })
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .groupBy(projects.publicationStatus);

  const tally: Record<string, number> = {
    draft: 0,
    submitted: 0,
    in_review: 0,
    approved: 0,
    published: 0,
    rejected: 0,
  };
  let total = 0;
  for (const row of rows) {
    tally[row.status] = Number(row.value);
    total += Number(row.value);
  }
  return { tally, total };
}

export type MyProjectDetail = {
  project: {
    id: string;
    slug: string;
    ownerId: string;
    title: string;
    shortDescription: string;
    description: string | null;
    coverImage: string | null;
    projectType: ProjectType;
    status: ProjectLifecycleStatus;
    publicationStatus: ProjectPublicationStatus;
    reviewNote: string | null;
    departmentId: string | null;
    categoryId: string | null;
    academicYearId: string | null;
    semesterId: string | null;
    githubUrl: string | null;
    demoUrl: string | null;
    docsUrl: string | null;
    videoUrl: string | null;
    viewCount: number;
    likeCount: number;
    featured: boolean;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  members: Array<{
    userId: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    role: string;
    isOwner: boolean;
    position: number;
  }>;
  technologies: Array<{ id: string; name: string; slug: string }>;
  images: Array<{ id: string; path: string; alt: string | null; caption: string | null }>;
  sections: Array<{
    key: string;
    title: string | null;
    content: string | null;
    visible: boolean;
  }>;
};

/**
 * Full editable record for one project. Ownership is enforced here: returns
 * `null` for anything the signed-in student does not own.
 */
export async function getMyProject(
  projectId: string,
  ownerId: string,
): Promise<MyProjectDetail | null> {
  const rows = await db
    .select({ project: projects })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
    .limit(1);

  const project = rows[0]?.project;
  if (!project) return null;

  const [memberRows, techRows, imageRows, sectionRows] = await Promise.all([
    db
      .select({
        userId: projectMembers.userId,
        role: projectMembers.role,
        isOwner: projectMembers.isOwner,
        position: projectMembers.position,
        name: users.name,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(asc(projectMembers.position), asc(users.name)),
    db
      .select({
        id: technologies.id,
        name: technologies.name,
        slug: technologies.slug,
      })
      .from(projectTechnologies)
      .innerJoin(
        technologies,
        eq(projectTechnologies.technologyId, technologies.id),
      )
      .where(eq(projectTechnologies.projectId, projectId))
      .orderBy(asc(technologies.name)),
    db
      .select({
        id: projectImages.id,
        path: projectImages.path,
        alt: projectImages.alt,
        caption: projectImages.caption,
      })
      .from(projectImages)
      .where(eq(projectImages.projectId, projectId))
      .orderBy(asc(projectImages.position)),
    db
      .select({
        key: projectSections.key,
        title: projectSections.title,
        content: projectSections.content,
        visible: projectSections.visible,
      })
      .from(projectSections)
      .where(eq(projectSections.projectId, projectId))
      .orderBy(asc(projectSections.position)),
  ]);

  return {
    project,
    members: memberRows.map((row) => ({
      userId: row.userId,
      name: row.name,
      username: row.username,
      avatarUrl: row.avatarUrl,
      role: row.role,
      isOwner: Boolean(row.isOwner),
      position: row.position,
    })),
    technologies: techRows,
    images: imageRows,
    sections: sectionRows.map((row) => ({ ...row, visible: Boolean(row.visible) })),
  };
}

/* ------------------------------------------------------------------ */
/* Profile completion + review activity                                */
/* ------------------------------------------------------------------ */

export type ProfileCheck = {
  label: string;
  done: boolean;
  href: string;
};

export async function getProfileChecks(
  userId: string,
): Promise<{ checks: ProfileCheck[]; complete: number; total: number }> {
  const rows = await db
    .select({
      username: users.username,
      headline: users.headline,
      bio: users.bio,
      departmentId: users.departmentId,
      batch: users.batch,
      skills: users.skills,
      avatarUrl: users.avatarUrl,
      githubUsername: users.githubUsername,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  const socialRows = await db
    .select({ provider: socialLinks.provider })
    .from(socialLinks)
    .where(eq(socialLinks.userId, userId));

  const projectRows = await db
    .select({ value: count() })
    .from(projects)
    .where(
      and(
        eq(projects.ownerId, userId),
        inArray(projects.publicationStatus, ["approved", "published"]),
      ),
    );

  const skills = Array.isArray(user?.skills) ? (user.skills as string[]) : [];

  const checks: ProfileCheck[] = [
    { label: "College email confirmed", done: Boolean(user?.emailVerifiedAt), href: "/verify-email" },
    { label: "Profile handle chosen", done: Boolean(user?.username), href: "/dashboard/profile" },
    { label: "Headline added", done: Boolean(user?.headline), href: "/dashboard/profile" },
    { label: "Short bio written", done: Boolean(user?.bio), href: "/dashboard/profile" },
    { label: "Department & batch set", done: Boolean(user?.departmentId && user?.batch), href: "/dashboard/profile" },
    { label: "Skills listed", done: skills.length > 0, href: "/dashboard/profile" },
    { label: "Profile photo", done: Boolean(user?.avatarUrl), href: "/dashboard/profile" },
    { label: "GitHub username connected", done: Boolean(user?.githubUsername), href: "/dashboard/profile" },
    { label: "At least one social link", done: socialRows.length > 0, href: "/dashboard/profile" },
    { label: "First project approved", done: Number(projectRows[0]?.value ?? 0) > 0, href: "/dashboard/projects/new" },
  ];

  return {
    checks,
    complete: checks.filter((item) => item.done).length,
    total: checks.length,
  };
}

export type ReviewEvent = {
  projectId: string;
  slug: string;
  title: string;
  publicationStatus: ProjectPublicationStatus;
  reviewNote: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  publishedAt: Date | null;
};

/** Everything a student needs to know about moderation, newest first. */
export async function getReviewActivity(ownerId: string): Promise<ReviewEvent[]> {  const rows = await db
    .select({
      projectId: projects.id,
      slug: projects.slug,
      title: projects.title,
      publicationStatus: projects.publicationStatus,
      reviewNote: projects.reviewNote,
      submittedAt: projects.submittedAt,
      reviewedAt: projects.reviewedAt,
      publishedAt: projects.publishedAt,
    })
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .orderBy(desc(sql`COALESCE(${projects.reviewedAt}, ${projects.submittedAt}, ${projects.createdAt})`))
    .limit(30);

  return rows.filter(
    (row) =>
      Boolean(row.reviewedAt) ||
      Boolean(row.submittedAt) ||
      row.publicationStatus === "rejected",
  );
}

/** Connected social rows — only what the student actually added. */
export async function getMySocials(
  userId: string,
): Promise<Array<{ provider: string; url: string }>> {
  return db
    .select({ provider: socialLinks.provider, url: socialLinks.url })
    .from(socialLinks)
    .where(eq(socialLinks.userId, userId))
    .orderBy(asc(socialLinks.provider));
}
