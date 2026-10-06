/**
 * Read-only queries behind the `/admin` console.
 *
 * Nothing here writes: every mutation lives in `src/actions/admin.ts` so the
 * console has exactly one place where state changes (and where the audit log
 * is appended). Public queries stay in `./projects` / `./students`.
 */

import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import {
  PAGE_SIZE,
  PUBLICATION_STATUSES,
  type ProjectPublicationStatus,
} from "@/lib/constants";
import { db } from "@/lib/db";
import {
  academicYears,
  auditLogs,
  categories,
  departments,
  projectImages,
  projectMembers,
  projectSections,
  projectTechnologies,
  projects,
  reports,
  semesters,
  technologies,
  users,
} from "@/lib/db/schema";
import type {
  Project,
  ProjectImage,
  ProjectSection,
} from "@/lib/db/schema";
import { toLikePattern } from "@/lib/db/search-index";

import { projectTextMatch } from "./internal";
import type { Paginated } from "./projects";

/* ------------------------------------------------------------------ */
/* Shared shapes                                                       */
/* ------------------------------------------------------------------ */

export const REVIEW_QUEUE_STATUSES: ProjectPublicationStatus[] = [
  "submitted",
  "in_review",
  "approved",
  "published",
  "rejected",
  "draft",
];

export type AdminProjectRow = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  publicationStatus: ProjectPublicationStatus;
  projectType: string;
  featured: boolean;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  owner: {
    id: string;
    name: string;
    username: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  department: { name: string; slug: string } | null;
  openReportCount: number;
};

export type AdminReportRow = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  reporter: {
    id: string;
    name: string;
    username: string | null;
  } | null;
  project: {
    id: string;
    slug: string;
    title: string;
    publicationStatus: ProjectPublicationStatus;
    ownerId: string;
  };
};

export type AdminStudentRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  featured: boolean;
  emailVerifiedAt: Date | null;
  batch: number | null;
  headline: string | null;
  createdAt: Date;
  department: { name: string; slug: string; code: string | null } | null;
  projectCount: number;
};

export type AdminStatusCount = {
  status: ProjectPublicationStatus;
  label: string;
  tone: string;
  count: number;
};

export type AdminOverview = {
  statusCounts: AdminStatusCount[];
  totals: {
    projects: number;
    awaitingReview: number;
    published: number;
    openReports: number;
    students: number;
    admins: number;
    suspended: number;
    unverified: number;
  };
  recentSubmissions: AdminProjectRow[];
  openReports: AdminReportRow[];
};

/* ------------------------------------------------------------------ */
/* Review queue                                                        */
/* ------------------------------------------------------------------ */

export type AdminProjectQuery = {
  status?: ProjectPublicationStatus | "all";
  q?: string;
  page?: number;
  pageSize?: number;
};

const STATUS_TONES: Record<string, string> = Object.fromEntries(
  PUBLICATION_STATUSES.map((item) => [item.value, item.tone]),
);

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  PUBLICATION_STATUSES.map((item) => [item.value, item.label]),
);

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function statusTone(status: string): string {
  return STATUS_TONES[status] ?? "muted";
}

async function adminProjectWhere(query: AdminProjectQuery): Promise<SQL[]> {
  const conditions: SQL[] = [];

  if (query.status && query.status !== "all") {
    conditions.push(eq(projects.publicationStatus, query.status));
  }

  const text = await projectTextMatch(query.q, [
    sql`projects.title`,
    sql`projects.short_description`,
    sql`projects.description`,
  ]);
  if (text) conditions.push(text);

  return conditions;
}

/** One page of the moderation queue, newest submission first. */
export async function listAdminProjects(
  query: AdminProjectQuery = {},
): Promise<Paginated<AdminProjectRow>> {
  const where = await adminProjectWhere(query);
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(24, Math.max(1, query.pageSize ?? PAGE_SIZE));

  const countRows = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(projects)
    .where(and(...where));

  const total = Number(countRows[0]?.value ?? 0);

  const rows = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      title: projects.title,
      shortDescription: projects.shortDescription,
      publicationStatus: projects.publicationStatus,
      projectType: projects.projectType,
      featured: projects.featured,
      submittedAt: projects.submittedAt,
      reviewedAt: projects.reviewedAt,
      publishedAt: projects.publishedAt,
      createdAt: projects.createdAt,
      ownerId: projects.ownerId,
      ownerName: users.name,
      ownerUsername: users.username,
      ownerEmail: users.email,
      ownerAvatar: users.avatarUrl,
      departmentName: departments.name,
      departmentSlug: departments.slug,
      openReports: sql<number>`(
        SELECT COUNT(*) FROM reports r
        WHERE r.project_id = ${projects.id} AND r.status = 'open'
      )`,
    })
    .from(projects)
    .innerJoin(users, eq(projects.ownerId, users.id))
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(and(...where))
    .orderBy(
      desc(sql`COALESCE(${projects.submittedAt}, ${projects.createdAt})`),
      desc(projects.createdAt),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      shortDescription: row.shortDescription,
      publicationStatus: row.publicationStatus,
      projectType: row.projectType,
      featured: Boolean(row.featured),
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      owner: {
        id: row.ownerId,
        name: row.ownerName,
        username: row.ownerUsername,
        email: row.ownerEmail,
        avatarUrl: row.ownerAvatar,
      },
      department:
        row.departmentName && row.departmentSlug
          ? { name: row.departmentName, slug: row.departmentSlug }
          : null,
      openReportCount: Number(row.openReports ?? 0),
    })),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Counts per publication status for the overview tiles. */
export async function getPublicationStatusCounts(): Promise<AdminStatusCount[]> {
  const rows = await db
    .select({
      status: projects.publicationStatus,
      count: sql<number>`COUNT(*)`,
    })
    .from(projects)
    .groupBy(projects.publicationStatus);

  const counts = new Map(
    rows.map((row) => [row.status, Number(row.count ?? 0)]),
  );

  return PUBLICATION_STATUSES.map((item) => ({
    status: item.value,
    label: item.label,
    tone: item.tone,
    count: counts.get(item.value) ?? 0,
  }));
}

async function metric(where: SQL): Promise<number> {
  const rows = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(projects)
    .where(where);
  return Number(rows[0]?.value ?? 0);
}

/** Newest hand-ins — the queue's "what arrived while you were away" feed. */
export async function listRecentSubmissions(
  limit = 6,
): Promise<AdminProjectRow[]> {
  const rows = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      title: projects.title,
      shortDescription: projects.shortDescription,
      publicationStatus: projects.publicationStatus,
      projectType: projects.projectType,
      featured: projects.featured,
      submittedAt: projects.submittedAt,
      reviewedAt: projects.reviewedAt,
      publishedAt: projects.publishedAt,
      createdAt: projects.createdAt,
      ownerId: projects.ownerId,
      ownerName: users.name,
      ownerUsername: users.username,
      ownerEmail: users.email,
      ownerAvatar: users.avatarUrl,
      departmentName: departments.name,
      departmentSlug: departments.slug,
      openReports: sql<number>`(
        SELECT COUNT(*) FROM reports r
        WHERE r.project_id = ${projects.id} AND r.status = 'open'
      )`,
    })
    .from(projects)
    .innerJoin(users, eq(projects.ownerId, users.id))
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(sql`${projects.submittedAt} IS NOT NULL`)
    .orderBy(desc(projects.submittedAt))
    .limit(Math.min(24, limit));

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.shortDescription,
    publicationStatus: row.publicationStatus,
    projectType: row.projectType,
    featured: Boolean(row.featured),
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    owner: {
      id: row.ownerId,
      name: row.ownerName,
      username: row.ownerUsername,
      email: row.ownerEmail,
      avatarUrl: row.ownerAvatar,
    },
    department:
      row.departmentName && row.departmentSlug
        ? { name: row.departmentName, slug: row.departmentSlug }
        : null,
    openReportCount: Number(row.openReports ?? 0),
  }));
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    statusCounts,
    projectTotal,
    awaitingReview,
    published,
    openReports,
    studentRows,
    adminRows,
    suspendedRows,
    unverifiedRows,
    recentRows,
    reportRows,
  ] = await Promise.all([
    getPublicationStatusCounts(),
    metric(sql`1 = 1`),
    metric(
      inArray(projects.publicationStatus, [
        "submitted",
        "in_review",
      ] as ProjectPublicationStatus[]),
    ),
    metric(eq(projects.publicationStatus, "published")),
    db
      .select({ value: sql<number>`COUNT(*)` })
      .from(reports)
      .where(eq(reports.status, "open")),
    db
      .select({ value: sql<number>`COUNT(*)` })
      .from(users)
      .where(eq(users.role, "student")),
    db
      .select({ value: sql<number>`COUNT(*)` })
      .from(users)
      .where(eq(users.role, "admin")),
    db
      .select({ value: sql<number>`COUNT(*)` })
      .from(users)
      .where(eq(users.status, "suspended")),
    db
      .select({ value: sql<number>`COUNT(*)` })
      .from(users)
      .where(sql`${users.emailVerifiedAt} IS NULL`),
    listRecentSubmissions(6),
    listAdminReports({ status: "open", limit: 5 }),
  ]);

  return {
    statusCounts,
    totals: {
      projects: projectTotal,
      awaitingReview,
      published,
      openReports: Number(openReports[0]?.value ?? 0),
      students: Number(studentRows[0]?.value ?? 0),
      admins: Number(adminRows[0]?.value ?? 0),
      suspended: Number(suspendedRows[0]?.value ?? 0),
      unverified: Number(unverifiedRows[0]?.value ?? 0),
    },
    recentSubmissions: recentRows,
    openReports: reportRows,
  };
}

/* ------------------------------------------------------------------ */
/* Full review detail                                                  */
/* ------------------------------------------------------------------ */

export type AdminProjectDetail = {
  project: Project;
  owner: {
    id: string;
    name: string;
    username: string | null;
    email: string;
    avatarUrl: string | null;
    role: string;
    status: string;
  };
  reviewer: { name: string; username: string | null } | null;
  department: { name: string; slug: string; code: string | null } | null;
  category: { name: string; slug: string; icon: string | null; tone: string } | null;
  academicYear: string | null;
  semester: string | null;
  members: Array<{
    id: string;
    name: string;
    username: string | null;
    email: string;
    avatarUrl: string | null;
    role: string;
    isOwner: boolean;
    position: number;
  }>;
  technologies: Array<{
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    kind: string;
  }>;
  images: ProjectImage[];
  sections: ProjectSection[];
  reports: AdminReportRow[];
  history: Array<{
    id: string;
    action: string;
    detail: string | null;
    actor: { name: string; username: string | null } | null;
    createdAt: Date;
  }>;
};

export async function getAdminProjectDetail(
  projectId: string,
): Promise<AdminProjectDetail | null> {
  const rows = await db
    .select({
      project: projects,
      ownerName: users.name,
      ownerUsername: users.username,
      ownerEmail: users.email,
      ownerAvatar: users.avatarUrl,
      ownerRole: users.role,
      ownerStatus: users.status,
      reviewerName: sql<string | null>`(
        SELECT r.name FROM users r WHERE r.id = ${projects.reviewedById}
      )`,
      reviewerUsername: sql<string | null>`(
        SELECT r.username FROM users r WHERE r.id = ${projects.reviewedById}
      )`,
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
    .innerJoin(users, eq(projects.ownerId, users.id))
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .leftJoin(categories, eq(projects.categoryId, categories.id))
    .leftJoin(academicYears, eq(projects.academicYearId, academicYears.id))
    .leftJoin(semesters, eq(projects.semesterId, semesters.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [
    memberRows,
    technologyRows,
    imageRows,
    sectionRows,
    reportRows,
    historyRows,
  ] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: projectMembers.role,
        isOwner: projectMembers.isOwner,
        position: projectMembers.position,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(asc(projectMembers.position)),
    db
      .select({
        id: technologies.id,
        name: technologies.name,
        slug: technologies.slug,
        icon: technologies.icon,
        kind: technologies.kind,
      })
      .from(projectTechnologies)
      .innerJoin(
        technologies,
        eq(projectTechnologies.technologyId, technologies.id),
      )
      .where(eq(projectTechnologies.projectId, projectId))
      .orderBy(asc(technologies.name)),
    db
      .select()
      .from(projectImages)
      .where(eq(projectImages.projectId, projectId))
      .orderBy(asc(projectImages.position)),
    db
      .select()
      .from(projectSections)
      .where(eq(projectSections.projectId, projectId))
      .orderBy(asc(projectSections.position)),
    listReportsForProject(projectId),
    getProjectHistory(projectId),
  ]);

  return {
    project: row.project,
    owner: {
      id: row.project.ownerId,
      name: row.ownerName,
      username: row.ownerUsername,
      email: row.ownerEmail,
      avatarUrl: row.ownerAvatar,
      role: row.ownerRole,
      status: row.ownerStatus,
    },
    reviewer:
      row.reviewerName !== null
        ? { name: row.reviewerName, username: row.reviewerUsername }
        : null,
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
    members: memberRows.map((member) => ({
      id: member.id,
      name: member.name,
      username: member.username,
      email: member.email,
      avatarUrl: member.avatarUrl,
      role: member.role,
      isOwner: Boolean(member.isOwner),
      position: member.position,
    })),
    technologies: technologyRows,
    images: imageRows,
    sections: sectionRows,
    reports: reportRows,
    history: historyRows,
  };
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

function reportQuery() {
  return db
    .select({
      id: reports.id,
      reason: reports.reason,
      details: reports.details,
      status: reports.status,
      createdAt: reports.createdAt,
      resolvedAt: reports.resolvedAt,
      reporterId: reports.reporterId,
      reporterName: users.name,
      reporterUsername: users.username,
      projectId: projects.id,
      projectSlug: projects.slug,
      projectTitle: projects.title,
      projectStatus: projects.publicationStatus,
      projectOwnerId: projects.ownerId,
    })
    .from(reports)
    .innerJoin(projects, eq(reports.projectId, projects.id))
    .leftJoin(users, eq(reports.reporterId, users.id));
}

type RawReportRow = Awaited<ReturnType<typeof reportQuery>>[number];

function toReportRow(row: RawReportRow): AdminReportRow {
  return {
    id: row.id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    reporter:
      row.reporterId && row.reporterName
        ? {
            id: row.reporterId,
            name: row.reporterName,
            username: row.reporterUsername,
          }
        : null,
    project: {
      id: row.projectId,
      slug: row.projectSlug,
      title: row.projectTitle,
      publicationStatus: row.projectStatus,
      ownerId: row.projectOwnerId,
    },
  };
}

export async function listAdminReports(
  options: { status?: "open" | "resolved" | "dismissed" | "all"; limit?: number } = {},
): Promise<AdminReportRow[]> {
  const { status = "open", limit = 50 } = options;
  const conditions: SQL[] = [];
  if (status !== "all") conditions.push(eq(reports.status, status));

  const rows = await reportQuery()
    .where(and(...conditions))
    .orderBy(desc(reports.createdAt))
    .limit(Math.min(200, limit));

  return rows.map(toReportRow);
}

async function listReportsForProject(projectId: string): Promise<AdminReportRow[]> {
  const rows = await reportQuery()
    .where(eq(reports.projectId, projectId))
    .orderBy(desc(reports.createdAt))
    .limit(50);
  return rows.map(toReportRow);
}

export type AuditEntry = {
  id: string;
  action: string;
  detail: string | null;
  actor: { name: string; username: string | null } | null;
  createdAt: Date;
};

function auditQuery() {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      detail: auditLogs.detail,
      createdAt: auditLogs.createdAt,
      actorId: auditLogs.actorId,
      actorName: users.name,
      actorUsername: users.username,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id));
}

type RawAuditRow = Awaited<ReturnType<typeof auditQuery>>[number];

function toAuditEntry(row: RawAuditRow): AuditEntry {
  return {
    id: row.id,
    action: row.action,
    detail: row.detail,
    createdAt: row.createdAt,
    actor:
      row.actorId && row.actorName
        ? { name: row.actorName, username: row.actorUsername }
        : null,
  };
}

async function getProjectHistory(projectId: string): Promise<AuditEntry[]> {
  const rows = await auditQuery()
    .where(and(eq(auditLogs.entity, "project"), eq(auditLogs.entityId, projectId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);
  return rows.map(toAuditEntry);
}

export async function listRecentAuditLogs(limit = 8): Promise<AuditEntry[]> {
  const rows = await auditQuery()
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(50, limit));
  return rows.map(toAuditEntry);
}

/* ------------------------------------------------------------------ */
/* Students directory                                                  */
/* ------------------------------------------------------------------ */

export type AdminStudentQuery = {
  q?: string;
  role?: "all" | "student" | "admin";
  status?: "all" | "active" | "suspended";
  page?: number;
  pageSize?: number;
};

export async function listAdminStudents(
  query: AdminStudentQuery = {},
): Promise<Paginated<AdminStudentRow>> {
  const conditions: SQL[] = [];

  if (query.role && query.role !== "all") {
    conditions.push(eq(users.role, query.role));
  }
  if (query.status && query.status !== "all") {
    conditions.push(eq(users.status, query.status));
  }
  if (query.q) {
    const pattern = toLikePattern(query.q);
    conditions.push(
      sql`(${users.name} LIKE ${pattern} ESCAPE '\\'
        OR ${users.username} LIKE ${pattern} ESCAPE '\\'
        OR ${users.email} LIKE ${pattern} ESCAPE '\\')`,
    );
  }

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(24, Math.max(1, query.pageSize ?? PAGE_SIZE));

  const countRows = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(...conditions));

  const total = Number(countRows[0]?.value ?? 0);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: users.role,
      status: users.status,
      featured: users.featured,
      emailVerifiedAt: users.emailVerifiedAt,
      batch: users.batch,
      headline: users.headline,
      createdAt: users.createdAt,
      departmentName: departments.name,
      departmentSlug: departments.slug,
      departmentCode: departments.code,
      projectCount: sql<number>`(
        SELECT COUNT(*) FROM projects p WHERE p.owner_id = ${users.id}
      )`,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(...conditions))
    .orderBy(
      desc(users.featured),
      sql`LOWER(${users.name}) ASC`,
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      avatarUrl: row.avatarUrl,
      role: row.role,
      status: row.status,
      featured: Boolean(row.featured),
      emailVerifiedAt: row.emailVerifiedAt,
      batch: row.batch,
      headline: row.headline,
      createdAt: row.createdAt,
      department:
        row.departmentName && row.departmentSlug
          ? {
              name: row.departmentName,
              slug: row.departmentSlug,
              code: row.departmentCode,
            }
          : null,
      projectCount: Number(row.projectCount ?? 0),
    })),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/* ------------------------------------------------------------------ */
/* Taxonomy                                                            */
/* ------------------------------------------------------------------ */

export const TAXONOMY_KINDS = [
  "department",
  "category",
  "technology",
  "academic_year",
  "semester",
] as const;

export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

export function isTaxonomyKind(value: string): value is TaxonomyKind {
  return (TAXONOMY_KINDS as readonly string[]).includes(value);
}

export type TaxonomyAdminRow = {
  id: string;
  name: string;
  slug: string;
  /** Secondary column: department code, technology kind, year range… */
  meta: string | null;
  active: boolean | null;
  position: number;
  usageCount: number;
};

const TAXONOMY_TITLES: Record<TaxonomyKind, string> = {
  department: "Departments",
  category: "Categories",
  technology: "Technologies",
  academic_year: "Academic years",
  semester: "Semesters",
};

export function taxonomyTitle(kind: TaxonomyKind): string {
  return TAXONOMY_TITLES[kind];
}

/** Human noun for error copy: "3 projects still use this department". */
export function taxonomyNoun(kind: TaxonomyKind): string {
  switch (kind) {
    case "department":
      return "department";
    case "category":
      return "category";
    case "technology":
      return "technology";
    case "academic_year":
      return "academic year";
    case "semester":
      return "semester";
  }
}

export async function listTaxonomy(
  kind: TaxonomyKind,
): Promise<TaxonomyAdminRow[]> {
  switch (kind) {
    case "department": {
      const rows = await db
        .select({
          id: departments.id,
          name: departments.name,
          slug: departments.slug,
          meta: departments.code,
          active: departments.active,
          position: departments.position,
          usageCount: sql<number>`(
            SELECT COUNT(*) FROM projects p WHERE p.department_id = ${departments.id}
          )`,
        })
        .from(departments)
        .orderBy(asc(departments.position), asc(departments.name));
      return rows.map((row) => ({ ...row, usageCount: Number(row.usageCount ?? 0) }));
    }
    case "category": {
      const rows = await db
        .select({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          meta: categories.icon,
          active: categories.active,
          position: categories.position,
          usageCount: sql<number>`(
            SELECT COUNT(*) FROM projects p WHERE p.category_id = ${categories.id}
          )`,
        })
        .from(categories)
        .orderBy(asc(categories.position), asc(categories.name));
      return rows.map((row) => ({ ...row, usageCount: Number(row.usageCount ?? 0) }));
    }
    case "technology": {
      const rows = await db
        .select({
          id: technologies.id,
          name: technologies.name,
          slug: technologies.slug,
          meta: technologies.kind,
          active: technologies.active,
          position: sql<number>`0`,
          usageCount: sql<number>`(
            SELECT COUNT(*) FROM project_technologies pt
            WHERE pt.technology_id = ${technologies.id}
          )`,
        })
        .from(technologies)
        .orderBy(asc(technologies.name));
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        meta: row.meta,
        active: row.active,
        position: Number(row.position ?? 0),
        usageCount: Number(row.usageCount ?? 0),
      }));
    }
    case "academic_year": {
      const rows = await db
        .select({
          id: academicYears.id,
          name: academicYears.label,
          slug: academicYears.slug,
          meta: sql<string>`CAST(${academicYears.startYear} AS TEXT) || '-' || ${academicYears.endYear}`,
          active: sql<boolean | null>`NULL`,
          position: academicYears.position,
          usageCount: sql<number>`(
            SELECT COUNT(*) FROM projects p
            WHERE p.academic_year_id = ${academicYears.id}
          )`,
        })
        .from(academicYears)
        .orderBy(desc(academicYears.startYear));
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        meta: row.meta,
        active: null,
        position: Number(row.position ?? 0),
        usageCount: Number(row.usageCount ?? 0),
      }));
    }
    case "semester": {
      const rows = await db
        .select({
          id: semesters.id,
          name: semesters.label,
          slug: semesters.slug,
          meta: sql<string | null>`NULL`,
          active: sql<boolean | null>`NULL`,
          position: semesters.position,
          usageCount: sql<number>`(
            SELECT COUNT(*) FROM projects p WHERE p.semester_id = ${semesters.id}
          )`,
        })
        .from(semesters)
        .orderBy(asc(semesters.position));
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        meta: row.meta,
        active: null,
        position: Number(row.position ?? 0),
        usageCount: Number(row.usageCount ?? 0),
      }));
    }
  }
}

/** Rows still referencing a taxonomy entry — drives the friendly delete block. */
export async function countTaxonomyUsage(
  kind: TaxonomyKind,
  id: string,
): Promise<number> {
  const total = (rows: Array<{ count: unknown }>): number =>
    Number(rows[0]?.count ?? 0);

  switch (kind) {
    case "department": {
      // Projects *and* student profiles hang off a department.
      const [projectRows, userRows] = await Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(projects)
          .where(eq(projects.departmentId, id)),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(users)
          .where(eq(users.departmentId, id)),
      ]);
      return total(projectRows) + total(userRows);
    }
    case "category": {
      const rows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(projects)
        .where(eq(projects.categoryId, id));
      return total(rows);
    }
    case "technology": {
      const rows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(projectTechnologies)
        .where(eq(projectTechnologies.technologyId, id));
      return total(rows);
    }
    case "academic_year": {
      const rows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(projects)
        .where(eq(projects.academicYearId, id));
      return total(rows);
    }
    case "semester": {
      const rows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(projects)
        .where(eq(projects.semesterId, id));
      return total(rows);
    }
  }
}

export type TaxonomyTarget = {
  id: string;
  name: string;
  slug: string;
  active: boolean | null;
};

/** Resolves one row for a mutation, so actions can echo its name back. */
export async function getTaxonomyTarget(
  kind: TaxonomyKind,
  id: string,
): Promise<TaxonomyTarget | null> {
  switch (kind) {
    case "department": {
      const [row] = await db
        .select({
          id: departments.id,
          name: departments.name,
          slug: departments.slug,
          active: departments.active,
        })
        .from(departments)
        .where(eq(departments.id, id))
        .limit(1);
      return row ?? null;
    }
    case "category": {
      const [row] = await db
        .select({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          active: categories.active,
        })
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1);
      return row ?? null;
    }
    case "technology": {
      const [row] = await db
        .select({
          id: technologies.id,
          name: technologies.name,
          slug: technologies.slug,
          active: technologies.active,
        })
        .from(technologies)
        .where(eq(technologies.id, id))
        .limit(1);
      return row ?? null;
    }
    case "academic_year": {
      const [row] = await db
        .select({
          id: academicYears.id,
          name: academicYears.label,
          slug: academicYears.slug,
          active: sql<boolean | null>`NULL`,
        })
        .from(academicYears)
        .where(eq(academicYears.id, id))
        .limit(1);
      return row ? { ...row, active: null } : null;
    }
    case "semester": {
      const [row] = await db
        .select({
          id: semesters.id,
          name: semesters.label,
          slug: semesters.slug,
          active: sql<boolean | null>`NULL`,
        })
        .from(semesters)
        .where(eq(semesters.id, id))
        .limit(1);
      return row ? { ...row, active: null } : null;
    }
  }
}

/** Whether a generated slug is already taken in this taxonomy table. */
export async function isTaxonomySlugTaken(
  kind: TaxonomyKind,
  slug: string,
): Promise<boolean> {
  switch (kind) {
    case "department": {
      const rows = await db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.slug, slug))
        .limit(1);
      return rows.length > 0;
    }
    case "category": {
      const rows = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);
      return rows.length > 0;
    }
    case "technology": {
      const rows = await db
        .select({ id: technologies.id })
        .from(technologies)
        .where(eq(technologies.slug, slug))
        .limit(1);
      return rows.length > 0;
    }
    case "academic_year": {
      const rows = await db
        .select({ id: academicYears.id })
        .from(academicYears)
        .where(eq(academicYears.slug, slug))
        .limit(1);
      return rows.length > 0;
    }
    case "semester": {
      const rows = await db
        .select({ id: semesters.id })
        .from(semesters)
        .where(eq(semesters.slug, slug))
        .limit(1);
      return rows.length > 0;
    }
  }
}
