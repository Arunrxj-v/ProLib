import {
  and,
  asc,
  desc,
  eq,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";

import type {
  ProjectPublicationStatus,
  ProjectSort,
} from "@/lib/constants";
import { PAGE_SIZE, PUBLICATION_STATUSES, PUBLIC_PUBLICATION_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  academicYears,
  categories,
  departments,
  projectImages,
  projectLikes,
  projectMembers,
  projectSections,
  projectTechnologies,
  projects,
  semesters,
  technologies,
  users,
} from "@/lib/db/schema";
import type { Project, ProjectSection } from "@/lib/db/schema";
import { isModerationEnabled } from "@/lib/settings";

import { projectTextMatch } from "./internal";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ProjectRef = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  batch: number | null;
  departmentCode: string | null;
};

export type ProjectCardData = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  coverImage: string | null;
  projectType: string;
  status: string;
  publicationStatus: string;
  featured: boolean;
  viewCount: number;
  likeCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  githubUrl: string | null;
  demoUrl: string | null;
  department: { name: string; slug: string } | null;
  category: { name: string; slug: string; icon: string | null; tone: string } | null;
  academicYear: string | null;
  semester: string | null;
  technologies: Array<{ name: string; slug: string; icon: string | null }>;
  owner: ProjectRef | null;
  members: ProjectRef[];
  teamSize: number;
};

export type ProjectQuery = {
  q?: string;
  department?: string;
  category?: string;
  type?: string;
  status?: string;
  technology?: string;
  year?: string;
  /** Only projects that publish a repository. */
  openSource?: boolean;
  sort?: ProjectSort;
  page?: number;
  pageSize?: number;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  pageCount: number;
};

/* ------------------------------------------------------------------ */
/* Visibility                                                          */
/* ------------------------------------------------------------------ */

/**
 * Which publication states are visible in the public library.
 * Drafts are never public. With moderation on, only reviewed work shows.
 */
export async function getPublicStatuses(): Promise<ProjectPublicationStatus[]> {
  const moderation = await isModerationEnabled();
  if (moderation) return [...PUBLIC_PUBLICATION_STATUSES];
  return ["submitted", "in_review", "approved", "rejected", "published"];
}

/* ------------------------------------------------------------------ */
/* Query building                                                      */
/* ------------------------------------------------------------------ */

const cardColumns = {
  id: projects.id,
  slug: projects.slug,
  title: projects.title,
  shortDescription: projects.shortDescription,
  coverImage: projects.coverImage,
  projectType: projects.projectType,
  status: projects.status,
  publicationStatus: projects.publicationStatus,
  featured: projects.featured,
  viewCount: projects.viewCount,
  likeCount: projects.likeCount,
  publishedAt: projects.publishedAt,
  createdAt: projects.createdAt,
  githubUrl: projects.githubUrl,
  demoUrl: projects.demoUrl,
  ownerId: projects.ownerId,
  departmentName: departments.name,
  departmentSlug: departments.slug,
  categoryName: categories.name,
  categorySlug: categories.slug,
  categoryIcon: categories.icon,
  categoryTone: categories.tone,
  yearLabel: academicYears.label,
  semesterLabel: semesters.label,
};

type RawCardRow = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  coverImage: string | null;
  projectType: string;
  status: string;
  publicationStatus: string;
  featured: number;
  viewCount: number;
  likeCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  githubUrl: string | null;
  demoUrl: string | null;
  ownerId: string;
  departmentName: string | null;
  departmentSlug: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  categoryIcon: string | null;
  categoryTone: string | null;
  yearLabel: string | null;
  semesterLabel: string | null;
};

const SORTS: Record<ProjectSort, SQL> = {
  newest: desc(sql`COALESCE(${projects.publishedAt}, ${projects.createdAt})`),
  popular: desc(projects.likeCount),
  views: desc(projects.viewCount),
  trending: desc(sql`(${projects.likeCount} * 3 + ${projects.viewCount} / 25)`),
};

async function baseWhere(query: ProjectQuery, statuses: ProjectPublicationStatus[]): Promise<SQL[]> {
  const conditions: SQL[] = [inArray(projects.publicationStatus, statuses)];

  if (query.department) {
    conditions.push(eq(departments.slug, query.department));
  }
  if (query.category) {
    conditions.push(eq(categories.slug, query.category));
  }
  if (query.year) {
    conditions.push(eq(academicYears.slug, query.year));
  }
  if (query.type) {
    conditions.push(sql`${projects.projectType} = ${query.type}`);
  }
  if (query.status) {
    // `status` carries a publication state (§20: DRAFT/PUBLISHED/…) when the
    // value is one, otherwise the lifecycle status (in_progress/completed).
    // The two value sets are disjoint, so there is no ambiguity — and the
    // caller's visibility rules still apply on top either way.
    const isPublicationState = PUBLICATION_STATUSES.some(
      (item) => item.value === query.status,
    );
    conditions.push(
      isPublicationState
        ? sql`${projects.publicationStatus} = ${query.status}`
        : sql`${projects.status} = ${query.status}`,
    );
  }
  if (query.technology) {
    conditions.push(sql`projects.id IN (
      SELECT pt.project_id FROM project_technologies pt
      JOIN technologies t ON t.id = pt.technology_id
      WHERE t.slug = ${query.technology}
    )`);
  }

  if (query.openSource) {
    conditions.push(sql`projects.github_url IS NOT NULL`);
  }

  const textCondition = await projectTextMatch(query.q, [
    sql`projects.title`,
    sql`projects.short_description`,
    sql`projects.description`,
  ]);
  if (textCondition) conditions.push(textCondition);

  return conditions;
}

function baseQuery(where: SQL[]) {
  return db
    .select(cardColumns)
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .leftJoin(categories, eq(projects.categoryId, categories.id))
    .leftJoin(academicYears, eq(projects.academicYearId, academicYears.id))
    .leftJoin(semesters, eq(projects.semesterId, semesters.id))
    .where(and(...where));
}

/* ------------------------------------------------------------------ */
/* Hydration                                                           */
/* ------------------------------------------------------------------ */

type MemberRow = {
  projectId: string;
  userId: string;
  isOwner: boolean;
  position: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  batch: number | null;
  departmentCode: string | null;
};

function toRef(row: MemberRow): ProjectRef {
  return {
    id: row.userId,
    name: row.name,
    username: row.username,
    avatarUrl: row.avatarUrl,
    batch: row.batch,
    departmentCode: row.departmentCode,
  };
}

/** Loads technologies and team members for a page of projects (no N+1). */
async function hydrate(rows: RawCardRow[]): Promise<ProjectCardData[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const [techRows, memberRows] = await Promise.all([
    db
      .select({
        projectId: projectTechnologies.projectId,
        name: technologies.name,
        slug: technologies.slug,
        icon: technologies.icon,
      })
      .from(projectTechnologies)
      .innerJoin(technologies, eq(projectTechnologies.technologyId, technologies.id))
      .where(inArray(projectTechnologies.projectId, ids))
      .orderBy(asc(technologies.name)),
    db
      .select({
        projectId: projectMembers.projectId,
        userId: projectMembers.userId,
        isOwner: projectMembers.isOwner,
        position: projectMembers.position,
        name: users.name,
        username: users.username,
        avatarUrl: users.avatarUrl,
        batch: users.batch,
        departmentCode: departments.code,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(inArray(projectMembers.projectId, ids))
      .orderBy(asc(projectMembers.position)),
  ]);

  const techByProject = new Map<string, ProjectCardData["technologies"]>();
  for (const row of techRows) {
    const list = techByProject.get(row.projectId) ?? [];
    list.push({ name: row.name, slug: row.slug, icon: row.icon });
    techByProject.set(row.projectId, list);
  }

  const membersByProject = new Map<string, MemberRow[]>();
  for (const row of memberRows) {
    const list = membersByProject.get(row.projectId) ?? [];
    list.push(row);
    membersByProject.set(row.projectId, list);
  }

  return rows.map((row) => {
    const projectMemberRows = membersByProject.get(row.id) ?? [];
    const members = projectMemberRows.map(toRef);
    const ownerRow =
      projectMemberRows.find((member) => member.isOwner) ??
      projectMemberRows.find((member) => member.userId === row.ownerId);
    const owner = ownerRow ? toRef(ownerRow) : null;

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      shortDescription: row.shortDescription,
      coverImage: row.coverImage,
      projectType: row.projectType,
      status: row.status,
      publicationStatus: row.publicationStatus,
      featured: Boolean(row.featured),
      viewCount: row.viewCount,
      likeCount: row.likeCount,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      githubUrl: row.githubUrl,
      demoUrl: row.demoUrl,
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
              tone: row.categoryTone ?? "accent",
            }
          : null,
      academicYear: row.yearLabel,
      semester: row.semesterLabel,
      technologies: techByProject.get(row.id) ?? [],
      owner,
      members,
      teamSize: Math.max(members.length, 1),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Public queries                                                      */
/* ------------------------------------------------------------------ */

export async function listProjects(
  query: ProjectQuery = {},
): Promise<Paginated<ProjectCardData>> {
  const statuses = await getPublicStatuses();
  const where = await baseWhere(query, statuses);
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, query.pageSize ?? PAGE_SIZE));

  const countRows = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .leftJoin(categories, eq(projects.categoryId, categories.id))
    .leftJoin(academicYears, eq(projects.academicYearId, academicYears.id))
    .leftJoin(semesters, eq(projects.semesterId, semesters.id))
    .where(and(...where));

  const total = Number(countRows[0]?.value ?? 0);

  const rows = (await baseQuery(where)
    .orderBy(SORTS[query.sort ?? "newest"] ?? SORTS.newest)
    .limit(pageSize)
    .offset((page - 1) * pageSize)) as unknown as RawCardRow[];

  return {
    items: await hydrate(rows),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getFeaturedProjects(limit = 3): Promise<ProjectCardData[]> {
  const statuses = await getPublicStatuses();
  const rows = (await db
    .select(cardColumns)
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .leftJoin(categories, eq(projects.categoryId, categories.id))
    .leftJoin(academicYears, eq(projects.academicYearId, academicYears.id))
    .leftJoin(semesters, eq(projects.semesterId, semesters.id))
    .where(and(inArray(projects.publicationStatus, statuses), eq(projects.featured, true)))
    .orderBy(SORTS.popular)
    .limit(limit)) as unknown as RawCardRow[];

  return hydrate(rows);
}

/**
 * Homepage showcase: prefers explicitly featured projects, then falls back to
 * the most-liked published work so the section is never artificially empty.
 */
export async function getShowcaseProjects(limit = 3): Promise<ProjectCardData[]> {
  const featured = await getFeaturedProjects(limit);
  if (featured.length >= limit) return featured;

  const statuses = await getPublicStatuses();
  const rows = (await db
    .select(cardColumns)
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .leftJoin(categories, eq(projects.categoryId, categories.id))
    .leftJoin(academicYears, eq(projects.academicYearId, academicYears.id))
    .leftJoin(semesters, eq(projects.semesterId, semesters.id))
    .where(and(inArray(projects.publicationStatus, statuses), eq(projects.featured, false)))
    .orderBy(SORTS.popular)
    .limit(limit - featured.length)) as unknown as RawCardRow[];

  return [...featured, ...(await hydrate(rows))].slice(0, limit);
}

/** Spotlight = the newest reviewed work, most liked first. */
export async function getSpotlightProjects(limit = 3): Promise<ProjectCardData[]> {
  const statuses = await getPublicStatuses();
  const rows = (await baseQuery([inArray(projects.publicationStatus, statuses)])
    .orderBy(SORTS.trending)
    .limit(limit)) as unknown as RawCardRow[];

  return hydrate(rows);
}

export async function getRecentProjects(limit = 6): Promise<ProjectCardData[]> {
  const statuses = await getPublicStatuses();
  const rows = (await baseQuery([inArray(projects.publicationStatus, statuses)])
    .orderBy(SORTS.newest)
    .limit(limit)) as unknown as RawCardRow[];

  return hydrate(rows);
}

export async function getTrendingProjects(limit = 6): Promise<ProjectCardData[]> {
  return listProjects({ sort: "trending", pageSize: limit }).then(
    (result) => result.items,
  );
}

/* ------------------------------------------------------------------ */
/* Single project                                                      */
/* ------------------------------------------------------------------ */

export type ProjectDetail = {
  project: Project;
  owner: ProjectRef;
  members: Array<ProjectRef & { role: string; isOwner: boolean }>;
  technologies: Array<{ id: string; name: string; slug: string; icon: string | null }>;
  images: Array<{ id: string; path: string; alt: string | null; caption: string | null }>;
  sections: ProjectSection[];
  department: { name: string; slug: string; code: string | null } | null;
  category: { name: string; slug: string; icon: string | null; tone: string } | null;
  academicYear: string | null;
  semester: string | null;
};

export async function getProjectBySlug(slug: string): Promise<ProjectDetail | null> {
  return loadProjectDetail(eq(projects.slug, slug));
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * REST addressing: `/api/projects/:id` accepts the public slug or the
 * internal UUID. Anything else resolves to null → 404.
 */
export async function getProjectByIdOrSlug(
  value: string,
): Promise<ProjectDetail | null> {
  const bySlug = await getProjectBySlug(value);
  if (bySlug) return bySlug;
  if (UUID_PATTERN.test(value)) return loadProjectDetail(eq(projects.id, value));
  return null;
}

async function loadProjectDetail(condition: SQL): Promise<ProjectDetail | null> {
  const rows = await db
    .select({
      project: projects,
      departmentName: departments.name,
      departmentSlug: departments.slug,
      departmentCode: departments.code,
      categoryName: categories.name,
      categorySlug: categories.slug,
      categoryIcon: categories.icon,
      categoryTone: categories.tone,
      yearLabel: academicYears.label,
      semesterLabel: semesters.label,
    })
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .leftJoin(categories, eq(projects.categoryId, categories.id))
    .leftJoin(academicYears, eq(projects.academicYearId, academicYears.id))
    .leftJoin(semesters, eq(projects.semesterId, semesters.id))
    .where(condition)
    .limit(1);

  const row = rows[0];
  if (!row) return null;

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
        batch: users.batch,
        departmentCode: departments.code,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(projectMembers.projectId, row.project.id))
      .orderBy(asc(projectMembers.position)),
    db
      .select({
        id: technologies.id,
        name: technologies.name,
        slug: technologies.slug,
        icon: technologies.icon,
      })
      .from(projectTechnologies)
      .innerJoin(technologies, eq(projectTechnologies.technologyId, technologies.id))
      .where(eq(projectTechnologies.projectId, row.project.id))
      .orderBy(asc(technologies.name)),
    db
      .select()
      .from(projectImages)
      .where(eq(projectImages.projectId, row.project.id))
      .orderBy(asc(projectImages.position)),
    db
      .select()
      .from(projectSections)
      .where(and(eq(projectSections.projectId, row.project.id), eq(projectSections.visible, true)))
      .orderBy(asc(projectSections.position)),
  ]);

  const members = memberRows.map((member) => ({
    ...toRef(member as unknown as MemberRow),
    role: member.role,
    isOwner: Boolean(member.isOwner),
  }));

  const owner = members.find((member) => member.isOwner) ??
    members.find((member) => member.id === row.project.ownerId) ?? {
      id: row.project.ownerId,
      name: "",
      username: null,
      avatarUrl: null,
      batch: null,
      departmentCode: null,
    };

  return {
    project: row.project,
    owner,
    members,
    technologies: techRows.map((tech) => ({
      id: tech.id,
      name: tech.name,
      slug: tech.slug,
      icon: tech.icon,
    })),
    images: imageRows.map((image) => ({
      id: image.id,
      path: image.path,
      alt: image.alt,
      caption: image.caption,
    })),
    sections: sectionRows,
    department:
      row.departmentName && row.departmentSlug
        ? {
            name: row.departmentName,
            slug: row.departmentSlug,
            code: row.departmentCode,
          }
        : null,
      category:
        row.categoryName && row.categorySlug
          ? {
              name: row.categoryName,
              slug: row.categorySlug,
              icon: row.categoryIcon,
              tone: row.categoryTone ?? "accent",
            }
          : null,
    academicYear: row.yearLabel,
    semester: row.semesterLabel,
  };
}

/** Increments the public view counter. Called only by the beacon endpoint. */
export async function recordProjectView(projectId: string): Promise<void> {
  await db
    .update(projects)
    .set({ viewCount: sql`${projects.viewCount} + 1` })
    .where(eq(projects.id, projectId));
}

/** Projects authored by a student — public ones, plus their own drafts. */
export async function listProjectsForOwner(
  ownerId: string,
  options: { includePrivate?: boolean } = {},
): Promise<ProjectCardData[]> {
  const statuses = options.includePrivate
    ? undefined
    : await getPublicStatuses();

  const where: SQL[] = [eq(projects.ownerId, ownerId)];
  if (statuses) where.push(inArray(projects.publicationStatus, statuses));

  const rows = (await baseQuery(where).orderBy(SORTS.newest)) as unknown as RawCardRow[];
  return hydrate(rows);
}

/**
 * Resolves an explicit list of ids (used by profile pages for team
 * membership). Non-public projects are filtered out for anonymous viewers.
 */
export async function listProjectsByIds(
  ids: string[],
  options: { includePrivate?: boolean } = {},
): Promise<ProjectCardData[]> {
  if (ids.length === 0) return [];

  const statuses = options.includePrivate
    ? undefined
    : await getPublicStatuses();

  const conditions: SQL[] = [inArray(projects.id, ids)];
  if (statuses) conditions.push(inArray(projects.publicationStatus, statuses));

  const rows = (await baseQuery(conditions).orderBy(
    SORTS.newest,
  )) as unknown as RawCardRow[];

  return hydrate(rows);
}

/** Same category (or the same department as a fallback) for "related work". */
export async function getRelatedProjects(
  project: Project,
  limit = 3,
): Promise<ProjectCardData[]> {
  const statuses = await getPublicStatuses();

  const conditions: SQL[] = [
    inArray(projects.publicationStatus, statuses),
    sql`${projects.id} != ${project.id}`,
  ];

  if (project.categoryId) {
    conditions.push(eq(projects.categoryId, project.categoryId));
  } else if (project.departmentId) {
    conditions.push(eq(projects.departmentId, project.departmentId));
  } else {
    return [];
  }

  const rows = (await baseQuery(conditions)
    .orderBy(SORTS.popular)
    .limit(limit)) as unknown as RawCardRow[];

  const related = await hydrate(rows);
  if (related.length >= limit) return related;

  // Fall back to the whole archive so the section is never artificially empty.
  const filler = await listProjects({ sort: "popular", pageSize: limit * 2 });
  const seen = new Set([...related.map((item) => item.id), project.id]);
  return [...related, ...filler.items.filter((item) => !seen.has(item.id))].slice(
    0,
    limit,
  );
}

/** Whether the viewer has already liked this project (for the button state). */
export async function hasUserLiked(
  projectId: string,
  userId: string | null,
): Promise<boolean> {
  if (!userId) return false;
  const rows = await db
    .select({ projectId: projectLikes.projectId })
    .from(projectLikes)
    .where(and(eq(projectLikes.projectId, projectId), eq(projectLikes.userId, userId)))
    .limit(1);
  return rows.length > 0;
}
