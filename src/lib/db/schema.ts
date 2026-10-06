import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  ProjectLifecycleStatus,
  ProjectPublicationStatus,
  ProjectSectionKey,
  ProjectType,
  ReportStatus,
  SocialProvider,
  UserRole,
  UserStatus,
} from "../constants";

/* ------------------------------------------------------------------ */
/* Shared columns                                                      */
/* ------------------------------------------------------------------ */

const createdAt = () =>
  timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`);

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date());

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true });

/* ------------------------------------------------------------------ */
/* Configurable taxonomies                                              */
/* ------------------------------------------------------------------ */

/** Departments are data, never hardcoded — admins add/remove them. */
export const departments = pgTable(
  "departments",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    code: text("code"),
    description: text("description"),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("departments_position_idx").on(t.position)],
);

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    /** Material Symbols name used on the category tile. */
    icon: text("icon"),
    /** Accent used for the tile / count, e.g. "accent" | "success" | "attention". */
    tone: text("tone").notNull().default("accent"),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("categories_position_idx").on(t.position)],
);

export const academicYears = pgTable(
  "academic_years",
  {
    id: text("id").primaryKey(),
    /** Display label, e.g. "2024-25". */
    label: text("label").notNull().unique(),
    slug: text("slug").notNull().unique(),
    startYear: integer("start_year").notNull(),
    endYear: integer("end_year").notNull(),
    current: boolean("current").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("academic_years_position_idx").on(t.position)],
);

export const semesters = pgTable("semesters", {
  id: text("id").primaryKey(),
  /** Display label, e.g. "Semester 5". */
  label: text("label").notNull().unique(),
  slug: text("slug").notNull().unique(),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

/** A technology is a real row: it can be filtered, counted and searched. */
export const technologies = pgTable(
  "technologies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    kind: text("kind").notNull().default("other"),
    /** Optional Material Symbols name shown inside the tech chip. */
    icon: text("icon"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("technologies_kind_idx").on(t.kind)],
);

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/**
 * One row per real account. The profile (§6: User → Profile) lives 1:1 on
 * this table — `id` is the shared primary key, never a separate copy.
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    emailVerifiedAt: timestamptz("email_verified_at"),
    /** scrypt digest — null when the account was created via college SSO. */
    passwordHash: text("password_hash"),
    name: text("name").notNull(),
    /** Public profile handle used at /students/[username]. */
    username: text("username").unique(),
    role: text("role").$type<UserRole>().notNull().default("student"),
    status: text("status").$type<UserStatus>().notNull().default("active"),
    avatarUrl: text("avatar_url"),
    headline: text("headline"),
    bio: text("bio"),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    /** Graduation year, e.g. 2025. */
    batch: integer("batch"),
    /** Free-form skill list, stored as a JSON array of strings. */
    skills: jsonb("skills").$type<string[]>().default(sql`'[]'::jsonb`),
    githubUsername: text("github_username"),
    githubConnectedAt: timestamptz("github_connected_at"),
    portfolioUrl: text("portfolio_url"),
    location: text("location"),
    featured: boolean("featured").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("users_department_idx").on(t.departmentId),
    index("users_batch_idx").on(t.batch),
    index("users_name_idx").on(t.name),
  ],
);

/** One row per connected account. Only existing rows are ever rendered. */
export const socialLinks = pgTable(
  "social_links",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").$type<SocialProvider>().notNull(),
    url: text("url").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("social_links_user_provider_uq").on(t.userId, t.provider),
    index("social_links_user_idx").on(t.userId),
  ],
);

/** Opaque session tokens. Only an HMAC digest is persisted. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamptz("expires_at").notNull(),
    lastSeenAt: timestamptz("last_seen_at"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* GitHub integration                                                  */
/* ------------------------------------------------------------------ */

/**
 * Linked GitHub identities — one row per ProLib user, written only by the
 * OAuth callback. `access_token` is server-side material and is stripped
 * from every public shape; a GitHub account can only ever be linked to a
 * single user (`github_id` is unique).
 */
export const githubAccounts = pgTable(
  "github_accounts",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
    login: text("login").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    htmlUrl: text("html_url"),
    /** OAuth access token — never sent to the browser, never logged. */
    accessToken: text("access_token"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("github_accounts_login_idx").on(t.login)],
);

/**
 * Referenced GitHub repositories (§23). GitHub stays the source of truth —
 * only the association and a light metadata cache live here, refreshed on
 * demand. Rows are created when a student connects or pastes a repository,
 * so even a manual URL becomes a real, queryable association.
 */
export const githubRepositories = pgTable(
  "github_repositories",
  {
    id: text("id").primaryKey(),
    /** Set when the repository was picked through a linked GitHub account. */
    linkedByUserId: text("linked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    /** "owner/name" — unique, the natural key on GitHub. */
    fullName: text("full_name").notNull().unique(),
    htmlUrl: text("html_url").notNull(),
    description: text("description"),
    stargazersCount: integer("stargazers_count").notNull().default(0),
    forksCount: integer("forks_count").notNull().default(0),
    language: text("language"),
    /** When this row's metadata was last refreshed from the GitHub API. */
    fetchedAt: timestamptz("fetched_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("github_repositories_owner_idx").on(t.owner),
    index("github_repositories_linked_by_idx").on(t.linkedByUserId),
  ],
);

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    shortDescription: text("short_description").notNull(),
    /** Long-form write-up (markdown). Rendered on the project page. */
    description: text("description"),
    coverImage: text("cover_image"),
    projectType: text("project_type")
      .$type<ProjectType>()
      .notNull()
      .default("other"),
    /** Student-facing project status: in progress / completed / archived. */
    status: text("status")
      .$type<ProjectLifecycleStatus>()
      .notNull()
      .default("in_progress"),
    /** Publishing workflow: draft -> submitted -> in_review -> approved/published. */
    publicationStatus: text("publication_status")
      .$type<ProjectPublicationStatus>()
      .notNull()
      .default("draft"),
    /** Reason handed back to the student when a submission is rejected. */
    reviewNote: text("review_note"),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    academicYearId: text("academic_year_id").references(
      () => academicYears.id,
      { onDelete: "set null" },
    ),
    semesterId: text("semester_id").references(() => semesters.id, {
      onDelete: "set null",
    }),
    /** Typed-in / pasted repository URL — always validated as absolute http(s). */
    githubUrl: text("github_url"),
    /** Real repository association (§23); GitHub remains source of truth. */
    githubRepositoryId: text("github_repository_id").references(
      () => githubRepositories.id,
      { onDelete: "set null" },
    ),
    demoUrl: text("demo_url"),
    docsUrl: text("docs_url"),
    videoUrl: text("video_url"),
    viewCount: integer("view_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    featured: boolean("featured").notNull().default(false),
    reviewedById: text("reviewed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamptz("submitted_at"),
    reviewedAt: timestamptz("reviewed_at"),
    publishedAt: timestamptz("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("projects_owner_idx").on(t.ownerId),
    index("projects_publication_idx").on(t.publicationStatus),
    index("projects_type_idx").on(t.projectType),
    index("projects_status_idx").on(t.status),
    index("projects_department_idx").on(t.departmentId),
    index("projects_category_idx").on(t.categoryId),
    index("projects_year_idx").on(t.academicYearId),
    index("projects_published_idx").on(t.publishedAt),
    index("projects_featured_idx").on(t.featured),
    index("projects_github_repo_idx").on(t.githubRepositoryId),
  ],
);

/** Real membership rows — never free-text names. */
export const projectMembers = pgTable(
  "project_members",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Role inside the team, e.g. "Developer", "ML Engineer", "UI/UX". */
    role: text("role").notNull().default("Member"),
    isOwner: boolean("is_owner").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index("project_members_user_idx").on(t.userId),
  ],
);

export const projectTechnologies = pgTable(
  "project_technologies",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    technologyId: text("technology_id")
      .notNull()
      .references(() => technologies.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.technologyId] }),
    index("project_technologies_technology_idx").on(t.technologyId),
  ],
);

export const projectImages = pgTable(
  "project_images",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Storage path, e.g. /uploads/projects/<id>/shot-1.png */
    path: text("path").notNull(),
    alt: text("alt"),
    caption: text("caption"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("project_images_project_idx").on(t.projectId, t.position)],
);

/** Optional narrative blocks: overview, problem, solution, features, ... */
export const projectSections = pgTable(
  "project_sections",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").$type<ProjectSectionKey>().notNull(),
    title: text("title"),
    content: text("content"),
    position: integer("position").notNull().default(0),
    visible: boolean("visible").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("project_sections_key_uq").on(t.projectId, t.key),
    index("project_sections_project_idx").on(t.projectId, t.position),
  ],
);

export const projectLikes = pgTable(
  "project_likes",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index("project_likes_user_idx").on(t.userId),
  ],
);

/* ------------------------------------------------------------------ */
/* Moderation                                                          */
/* ------------------------------------------------------------------ */

export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").$type<ReportStatus>().notNull().default("open"),
    resolvedById: text("resolved_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamptz("resolved_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("reports_project_idx").on(t.projectId),
    index("reports_status_idx").on(t.status),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_entity_idx").on(t.entity, t.entityId)],
);

/** Key/value platform settings (moderation toggle, site copy, ...). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});

/**
 * College email verification / sign-in tokens.
 * Only the digest is stored; the plaintext lives in the email.
 */
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    purpose: text("purpose").notNull().default("verify_email"),
    expiresAt: timestamptz("expires_at").notNull(),
    consumedAt: timestamptz("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("verification_tokens_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* Inferred types                                                      */
/* ------------------------------------------------------------------ */

export type Department = typeof departments.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type AcademicYear = typeof academicYears.$inferSelect;
export type Semester = typeof semesters.$inferSelect;
export type Technology = typeof technologies.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type SocialLink = typeof socialLinks.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type ProjectImage = typeof projectImages.$inferSelect;
export type ProjectSection = typeof projectSections.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type GithubAccount = typeof githubAccounts.$inferSelect;
export type GithubRepository = typeof githubRepositories.$inferSelect;
