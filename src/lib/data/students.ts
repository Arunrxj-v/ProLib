import { and, asc, desc, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";

import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  departments,
  projectMembers,
  projects,
  socialLinks,
  users,
} from "@/lib/db/schema";
import type { SocialProvider } from "@/lib/constants";

import { userTextMatch } from "./internal";
import { getPublicStatuses, type Paginated } from "./projects";

export type StudentCardData = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  batch: number | null;
  department: { name: string; slug: string; code: string | null } | null;
  skills: string[];
  githubUsername: string | null;
  featured: boolean;
  projectCount: number;
  totalViews: number;
  socials: Array<{ provider: SocialProvider; url: string }>;
};

export type StudentQuery = {
  q?: string;
  department?: string;
  page?: number;
  pageSize?: number;
};

type SocialRow = { userId: string; provider: SocialProvider; url: string };

async function loadSocials(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, Array<{ provider: SocialProvider; url: string }>>();
  const rows = (await db
    .select({
      userId: socialLinks.userId,
      provider: socialLinks.provider,
      url: socialLinks.url,
    })
    .from(socialLinks)
    .where(inArray(socialLinks.userId, userIds))) as SocialRow[];

  const map = new Map<string, Array<{ provider: SocialProvider; url: string }>>();
  for (const row of rows) {
    const list = map.get(row.userId) ?? [];
    list.push({ provider: row.provider, url: row.url });
    map.set(row.userId, list);
  }
  return map;
}

async function loadProjectStats(userIds: string[]) {
  const empty = new Map<string, { projectCount: number; totalViews: number }>();
  if (userIds.length === 0) return empty;

  const statuses = await getPublicStatuses();
  const rows = await db
    .select({
      ownerId: projects.ownerId,
      count: sql<number>`COUNT(*)`,
      views: sql<number>`COALESCE(SUM(${projects.viewCount}), 0)`,
    })
    .from(projects)
    .where(and(inArray(projects.ownerId, userIds), inArray(projects.publicationStatus, statuses)))
    .groupBy(projects.ownerId);

  const map = new Map<string, { projectCount: number; totalViews: number }>();
  for (const row of rows) {
    map.set(row.ownerId, {
      projectCount: Number(row.count),
      totalViews: Number(row.views),
    });
  }
  return map;
}

function toCard(
  row: {
    id: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    headline: string | null;
    bio: string | null;
    batch: number | null;
    skills: string[] | null;
    githubUsername: string | null;
    featured: boolean;
    departmentName: string | null;
    departmentSlug: string | null;
    departmentCode: string | null;
  },
  socials: Map<string, Array<{ provider: SocialProvider; url: string }>>,
  stats: Map<string, { projectCount: number; totalViews: number }>,
): StudentCardData {
  const stat = stats.get(row.id) ?? { projectCount: 0, totalViews: 0 };
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    avatarUrl: row.avatarUrl,
    headline: row.headline,
    bio: row.bio,
    batch: row.batch,
    department:
      row.departmentName && row.departmentSlug
        ? { name: row.departmentName, slug: row.departmentSlug, code: row.departmentCode }
        : null,
    skills: row.skills ?? [],
    githubUsername: row.githubUsername,
    featured: Boolean(row.featured),
    projectCount: stat.projectCount,
    totalViews: stat.totalViews,
    socials: socials.get(row.id) ?? [],
  };
}

const studentColumns = {
  id: users.id,
  name: users.name,
  username: users.username,
  avatarUrl: users.avatarUrl,
  headline: users.headline,
  bio: users.bio,
  batch: users.batch,
  skills: users.skills,
  githubUsername: users.githubUsername,
  featured: users.featured,
  departmentName: departments.name,
  departmentSlug: departments.slug,
  departmentCode: departments.code,
};

export async function listStudents(
  query: StudentQuery = {},
): Promise<Paginated<StudentCardData>> {
  const conditions: SQL[] = [eq(users.status, "active")];

  if (query.department) conditions.push(eq(departments.slug, query.department));

  const textCondition = await userTextMatch(query.q, [
    sql`users.name`,
    sql`users.username`,
    sql`users.headline`,
    sql`users.bio`,
  ]);
  if (textCondition) conditions.push(textCondition);

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, query.pageSize ?? PAGE_SIZE));

  const countRows = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(...conditions));

  const total = Number(countRows[0]?.value ?? 0);

  const rows = await db
    .select(studentColumns)
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(...conditions))
    .orderBy(desc(users.featured), sql`LOWER(${users.name}) ASC`)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const ids = rows.map((row) => row.id);
  const [socials, stats] = await Promise.all([loadSocials(ids), loadProjectStats(ids)]);

  return {
    items: rows.map((row) => toCard(row, socials, stats)),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getStudentByUsername(
  username: string,
): Promise<StudentCardData | null> {
  const rows = await db
    .select(studentColumns)
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.username, username), eq(users.status, "active")))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [socials, stats] = await Promise.all([
    loadSocials([row.id]),
    loadProjectStats([row.id]),
  ]);

  return toCard(row, socials, stats);
}

/** Projects where this student is a member (owner or teammate). */
export async function getStudentProjectIds(studentId: string): Promise<string[]> {
  const statuses = await getPublicStatuses();
  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(
      and(
        eq(projectMembers.userId, studentId),
        inArray(projects.publicationStatus, statuses),
      ),
    )
    .orderBy(desc(projects.publishedAt));

  return rows.map((row) => row.projectId);
}

export async function getStudentByUserId(userId: string) {
  const rows = await db
    .select(studentColumns)
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Used by the student directory sidebar / filter rail. */
export async function getStudentsOrderedByDepartment() {
  return db
    .select(studentColumns)
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.status, "active"))
    .orderBy(asc(departments.name), sql`LOWER(${users.name}) ASC`);
}

/* ------------------------------------------------------------------ */
/* Team picker typeahead                                               */
/* ------------------------------------------------------------------ */

export type StudentSearchHit = {
  id: string;
  name: string;
  username: string | null;
  headline: string | null;
  avatarUrl: string | null;
};

/**
 * Live lookup used by the team picker: matches active students by name or
 * handle. Only real accounts with a public handle come back — teammates are
 * always chosen from actual ProLib users, never typed in as free text.
 */
export async function searchStudents(
  query: string,
  limit = 6,
): Promise<StudentSearchHit[]> {
  const match = await userTextMatch(query, [sql`users.name`, sql`users.username`]);
  if (!match) return [];

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      headline: users.headline,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(and(eq(users.status, "active"), isNotNull(users.username), match))
    .orderBy(sql`LOWER(${users.name}) ASC`)
    .limit(Math.min(20, Math.max(1, limit)));

  return rows;
}

/**
 * How many students exist in the directory at all — lets the UI tell
 * "nobody has signed up yet" apart from "nobody matched your search".
 */
export async function countDirectoryStudents(): Promise<number> {
  const rows = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(users)
    .where(eq(users.status, "active"));
  return Number(rows[0]?.value ?? 0);
}
