"use server";

/**
 * Every mutation the `/admin` console can perform.
 *
 * Contract: each action re-checks `requireAdmin()` itself (the proxy only
 * checks cookie presence, the layout checks the role — this is the third,
 * authoritative layer), validates its own input, writes an `auditLogs` row and
 * revalidates the routes that changed. Forms consume these through
 * `useActionState`, so they all return the same `AdminActionState` shape.
 */

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  countTaxonomyUsage,
  getTaxonomyTarget,
  isTaxonomyKind,
  isTaxonomySlugTaken,
  statusLabel,
  type TaxonomyKind,
} from "@/lib/data/admin";
import { getPublicStatuses } from "@/lib/data/projects";
import { requireAdmin } from "@/lib/auth/guards";
import type { ProjectPublicationStatus, UserRole, UserStatus } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  academicYears,
  auditLogs,
  categories,
  departments,
  projects,
  reports,
  semesters,
  settings,
  technologies,
  users,
} from "@/lib/db/schema";
import { SETTING_KEYS, isModerationEnabled, setSetting } from "@/lib/settings";
import { slugify } from "@/lib/utils";

export type AdminActionState = {
  error?: string;
  info?: string;
  fieldErrors?: Record<string, string>;
  /** Values to repopulate a failed form with. */
  values?: Record<string, string>;
};

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function idOf(formData: FormData, key: string): string {
  return field(formData, key);
}

/** Appends one immutable audit row — every admin write goes through here. */
async function audit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string | null,
  detail: string | null,
): Promise<void> {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorId,
    action,
    entity,
    entityId,
    detail,
  });
}

function refresh(paths: string[]): void {
  for (const path of paths) {
    revalidatePath(path);
  }
}

async function loadProject(projectId: string) {
  if (!projectId) return null;
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return rows[0] ?? null;
}

async function loadUser(userId: string) {
  if (!userId) return null;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      featured: users.featured,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

const missingProject = { error: "That project no longer exists." };
const missingUser = { error: "That account no longer exists." };

/* ------------------------------------------------------------------ */
/* Moderation: projects                                                */
/* ------------------------------------------------------------------ */

/** Only submitted / in-review / rejected work may be approved. */
const APPROVABLE: ProjectPublicationStatus[] = [
  "submitted",
  "in_review",
  "rejected",
];

export async function approveProjectAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const note = field(formData, "note");
  const project = await loadProject(idOf(formData, "projectId"));
  if (!project) return missingProject;

  if (!APPROVABLE.includes(project.publicationStatus)) {
    return {
      error: `Only submitted, in-review or rejected projects can be approved — “${project.title}” is ${statusLabel(project.publicationStatus).toLowerCase()}.`,
    };
  }

  const now = new Date();
  await db
    .update(projects)
    .set({
      publicationStatus: "approved",
      reviewedById: admin.id,
      reviewedAt: now,
      reviewNote: note || null,
    })
    .where(eq(projects.id, project.id));

  await audit(
    admin.id,
    "project.approve",
    "project",
    project.id,
    note || `Approved “${project.title}”`,
  );

  refresh([
    "/admin",
    "/admin/projects",
    `/admin/projects/${project.id}`,
    `/projects/${project.slug}`,
  ]);

  return { info: `“${project.title}” is approved.` };
}

export async function rejectProjectAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const reason = field(formData, "reason");
  const project = await loadProject(idOf(formData, "projectId"));

  if (!project) return missingProject;

  // A rejection the student cannot act on is worse than no rejection at all.
  if (reason.length === 0) {
    return {
      fieldErrors: { reason: "Give the student a reason — it is required." },
      values: { reason },
    };
  }

  if (project.publicationStatus === "draft") {
    return {
      error: "Drafts are never in review — ask the team to submit it first.",
    };
  }

  const now = new Date();
  await db
    .update(projects)
    .set({
      publicationStatus: "rejected",
      reviewedById: admin.id,
      reviewedAt: now,
      reviewNote: reason,
    })
    .where(eq(projects.id, project.id));

  await audit(
    admin.id,
    "project.reject",
    "project",
    project.id,
    `Rejected “${project.title}”: ${reason}`,
  );

  refresh([
    "/admin",
    "/admin/projects",
    `/admin/projects/${project.id}`,
    `/projects/${project.slug}`,
  ]);

  return { info: `“${project.title}” was sent back with your reason.` };
}

export async function publishProjectAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const note = field(formData, "note");
  const project = await loadProject(idOf(formData, "projectId"));
  if (!project) return missingProject;

  const moderation = await isModerationEnabled();
  const publicStatuses = await getPublicStatuses();

  if (moderation) {
    if (
      project.publicationStatus !== "approved" &&
      project.publicationStatus !== "published"
    ) {
      return {
        error: `Moderation is on: approve “${project.title}” before publishing it.`,
      };
    }
  } else if (!publicStatuses.includes(project.publicationStatus)) {
    return {
      error: `“${project.title}” is a ${statusLabel(project.publicationStatus).toLowerCase()} project — submit it before publishing.`,
    };
  }

  const now = new Date();
  await db
    .update(projects)
    .set({
      publicationStatus: "published",
      publishedAt: project.publishedAt ?? now,
      reviewedById: admin.id,
      reviewedAt: now,
      reviewNote: note || project.reviewNote,
    })
    .where(eq(projects.id, project.id));

  await audit(
    admin.id,
    "project.publish",
    "project",
    project.id,
    note || `Published “${project.title}”`,
  );

  refresh([
    "/admin",
    "/admin/projects",
    `/admin/projects/${project.id}`,
    `/projects/${project.slug}`,
    "/explore",
  ]);

  return { info: `“${project.title}” is live in the library.` };
}

export async function unpublishProjectAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const project = await loadProject(idOf(formData, "projectId"));
  if (!project) return missingProject;

  if (project.publicationStatus !== "published") {
    return { error: "That project is not published." };
  }

  await db
    .update(projects)
    .set({
      publicationStatus: "approved",
      publishedAt: null,
      reviewedById: admin.id,
      reviewedAt: new Date(),
    })
    .where(eq(projects.id, project.id));

  await audit(
    admin.id,
    "project.unpublish",
    "project",
    project.id,
    `Unpublished “${project.title}”`,
  );

  refresh([
    "/admin",
    "/admin/projects",
    `/admin/projects/${project.id}`,
    `/projects/${project.slug}`,
    "/explore",
  ]);

  return { info: `“${project.title}” is approved but no longer public.` };
}

export async function toggleProjectFeatureAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const project = await loadProject(idOf(formData, "projectId"));
  if (!project) return missingProject;

  const featured = !project.featured;
  await db
    .update(projects)
    .set({ featured })
    .where(eq(projects.id, project.id));

  await audit(
    admin.id,
    featured ? "project.feature" : "project.unfeature",
    "project",
    project.id,
    `${featured ? "Featured" : "Unfeatured"} “${project.title}”`,
  );

  refresh([
    "/admin",
    "/admin/projects",
    `/admin/projects/${project.id}`,
    "/",
    "/explore",
  ]);

  return {
    info: featured
      ? `“${project.title}” now appears in the homepage showcase.`
      : `“${project.title}” was removed from the showcase.`,
  };
}

/* ------------------------------------------------------------------ */
/* Students                                                            */
/* ------------------------------------------------------------------ */

export async function setStudentStatusAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const userId = idOf(formData, "userId");
  const status = field(formData, "status");

  if (status !== "active" && status !== "suspended") {
    return { error: "Unknown account status." };
  }

  const user = await loadUser(userId);
  if (!user) return missingUser;
  if (user.id === admin.id && status === "suspended") {
    return { error: "You cannot suspend your own account." };
  }
  if (user.status === status) {
    return { info: `That account is already ${status}.` };
  }

  await db
    .update(users)
    .set({ status: status as UserStatus })
    .where(eq(users.id, user.id));

  await audit(
    admin.id,
    status === "suspended" ? "user.suspend" : "user.activate",
    "user",
    user.id,
    `${status === "suspended" ? "Suspended" : "Reactivated"} ${user.name} (${user.email})`,
  );

  refresh(["/admin", "/admin/students"]);

  return {
    info:
      status === "suspended"
        ? `${user.name} is suspended and can no longer sign in.`
        : `${user.name} can sign in again.`,
  };
}

export async function setStudentRoleAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const userId = idOf(formData, "userId");
  const role = field(formData, "role");

  if (role !== "student" && role !== "admin") {
    return { error: "Unknown role." };
  }

  const user = await loadUser(userId);
  if (!user) return missingUser;
  if (user.id === admin.id && role === "student") {
    return { error: "You cannot remove your own administrator access." };
  }
  if (user.role === role) {
    return { info: `That account already has the ${role} role.` };
  }

  await db
    .update(users)
    .set({ role: role as UserRole })
    .where(eq(users.id, user.id));

  await audit(
    admin.id,
    role === "admin" ? "user.grant_admin" : "user.revoke_admin",
    "user",
    user.id,
    `${role === "admin" ? "Granted admin to" : "Removed admin from"} ${user.name} (${user.email})`,
  );

  refresh(["/admin", "/admin/students"]);

  return {
    info:
      role === "admin"
        ? `${user.name} can now moderate the library.`
        : `${user.name} is a student again.`,
  };
}

export async function markEmailVerifiedAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const user = await loadUser(idOf(formData, "userId"));
  if (!user) return missingUser;

  if (user.emailVerifiedAt) {
    return { info: `${user.email} is already verified.` };
  }

  await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.id, user.id));

  await audit(
    admin.id,
    "user.verify_email",
    "user",
    user.id,
    `Marked ${user.email} as verified`,
  );

  refresh(["/admin", "/admin/students"]);

  return { info: `${user.email} is now marked as verified.` };
}

export async function toggleStudentFeatureAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const user = await loadUser(idOf(formData, "userId"));
  if (!user) return missingUser;

  const featured = !user.featured;
  await db
    .update(users)
    .set({ featured })
    .where(eq(users.id, user.id));

  await audit(
    admin.id,
    featured ? "user.feature" : "user.unfeature",
    "user",
    user.id,
    `${featured ? "Featured" : "Unfeatured"} ${user.name} in the directory`,
  );

  refresh(["/admin", "/admin/students", "/students"]);

  return {
    info: featured
      ? `${user.name} is featured in the student directory.`
      : `${user.name} is no longer featured.`,
  };
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

async function closeReport(
  reportId: string,
  outcome: "resolved" | "dismissed",
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  const rows = await db
    .select({
      id: reports.id,
      status: reports.status,
      reason: reports.reason,
      projectId: reports.projectId,
      projectTitle: projects.title,
      projectSlug: projects.slug,
    })
    .from(reports)
    .innerJoin(projects, eq(reports.projectId, projects.id))
    .where(eq(reports.id, reportId))
    .limit(1);

  const report = rows[0];
  if (!report) return { error: "That report no longer exists." };
  if (report.status !== "open") {
    return { error: "That report has already been handled." };
  }

  await db
    .update(reports)
    .set({
      status: outcome,
      resolvedById: admin.id,
      resolvedAt: new Date(),
    })
    .where(eq(reports.id, report.id));

  await audit(
    admin.id,
    `report.${outcome}`,
    "report",
    report.id,
    `${outcome === "resolved" ? "Resolved" : "Dismissed"} a “${report.reason}” report on “${report.projectTitle}”`,
  );

  refresh([
    "/admin",
    "/admin/reports",
    `/admin/projects/${report.projectId}`,
  ]);

  return {
    info:
      outcome === "resolved"
        ? "Report marked as resolved."
        : "Report dismissed.",
  };
}

export async function resolveReportAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return closeReport(idOf(formData, "reportId"), "resolved");
}

export async function dismissReportAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return closeReport(idOf(formData, "reportId"), "dismissed");
}

/* ------------------------------------------------------------------ */
/* Taxonomy                                                            */
/* ------------------------------------------------------------------ */

const NAME_MIN = 2;
const NAME_MAX = 60;

function validateName(name: string): Record<string, string> | null {
  if (name.length < NAME_MIN) {
    return { name: `Use at least ${NAME_MIN} characters.` };
  }
  if (name.length > NAME_MAX) {
    return { name: `Keep it under ${NAME_MAX} characters.` };
  }
  if (!slugify(name)) {
    return { name: "That name cannot be turned into a URL slug." };
  }
  return null;
}

function usagePhrase(kind: TaxonomyKind, count: number): string {
  const plural = count === 1 ? "" : "s";
  switch (kind) {
    case "department":
      return `${count} project${plural} or student profile${plural}`;
    case "technology":
      return `${count} project link${plural}`;
    case "category":
    case "academic_year":
    case "semester":
      return `${count} project${plural}`;
  }
}

async function nextPosition(kind: TaxonomyKind): Promise<number> {
  const table =
    kind === "department"
      ? departments
      : kind === "category"
        ? categories
        : kind === "technology"
          ? technologies
          : kind === "academic_year"
            ? academicYears
            : semesters;

  const rows = await db
    .select({ value: sql<number>`COALESCE(MAX(position), 0) + 1` })
    .from(table);
  return Number(rows[0]?.value ?? 1);
}

/** Academic years carry `startYear` / `endYear`, parsed from the label if unset. */
function parseYearRange(
  formData: FormData,
  label: string,
): { startYear: number; endYear: number } | { fieldErrors: Record<string, string> } {
  const rawStart = field(formData, "startYear");
  const rawEnd = field(formData, "endYear");

  let start = Number(rawStart);
  let end = Number(rawEnd);

  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    const match = label.match(/(\d{4})\s*[-–—]\s*(\d{2,4})/);
    if (match) {
      start = Number(match[1]);
      const tail = match[2];
      end = tail.length === 2 ? Math.floor(start / 100) * 100 + Number(tail) : Number(tail);
    }
  }

  const thisYear = new Date().getFullYear();
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 1950 ||
    end > thisYear + 10 ||
    end <= start ||
    end - start > 2
  ) {
    return {
      fieldErrors: {
        startYear:
          "Use a start and end year such as 2024 and 2025 (the range may span at most two years).",
      },
    };
  }

  return { startYear: start, endYear: end };
}

export async function createTaxonomyItemAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  const kindValue = field(formData, "kind");
  if (!isTaxonomyKind(kindValue)) {
    return { error: "Choose which list to add to." };
  }
  const kind: TaxonomyKind = kindValue;

  const name = field(formData, "name");
  const values = { kind, name };
  const nameError = validateName(name);
  if (nameError) return { fieldErrors: nameError, values };

  const slug = slugify(name);
  if (await isTaxonomySlugTaken(kind, slug)) {
    return {
      fieldErrors: { name: "An entry with that URL slug already exists." },
      values,
    };
  }

  const position = await nextPosition(kind);
  const id = crypto.randomUUID();

  if (kind === "department") {
    const code = field(formData, "code").slice(0, 12) || null;
    await db.insert(departments).values({ id, name, slug, code, position });
  } else if (kind === "category") {
    await db.insert(categories).values({ id, name, slug, position });
  } else if (kind === "technology") {
    const technologyKind = field(formData, "technologyKind").slice(0, 30) || "other";
    await db
      .insert(technologies)
      .values({ id, name, slug, kind: technologyKind, active: true });
  } else if (kind === "academic_year") {
    const range = parseYearRange(formData, name);
    if ("fieldErrors" in range) {
      return { fieldErrors: range.fieldErrors, values };
    }
    await db.insert(academicYears).values({
      id,
      label: name,
      slug,
      startYear: range.startYear,
      endYear: range.endYear,
      position,
    });
  } else {
    await db.insert(semesters).values({ id, label: name, slug, position });
  }

  await audit(admin.id, `${kind}.create`, kind, id, `Created “${name}” (${slug})`);

  refresh(["/admin", "/admin/taxonomy", "/explore", "/categories", "/technologies"]);

  return { info: `“${name}” was added.` };
}

export async function renameTaxonomyItemAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  const kindValue = field(formData, "kind");
  const id = idOf(formData, "id");
  if (!isTaxonomyKind(kindValue)) {
    return { error: "Unknown taxonomy list." };
  }
  const kind: TaxonomyKind = kindValue;

  const target = await getTaxonomyTarget(kind, id);
  if (!target) return { error: "That entry no longer exists." };

  const name = field(formData, "name");
  const values = { kind, id, name };
  const nameError = validateName(name);
  if (nameError) return { fieldErrors: nameError, values };

  // The slug is deliberately left alone: public links must keep working.
  if (kind === "department") {
    await db.update(departments).set({ name }).where(eq(departments.id, id));
  } else if (kind === "category") {
    await db.update(categories).set({ name }).where(eq(categories.id, id));
  } else if (kind === "technology") {
    await db.update(technologies).set({ name }).where(eq(technologies.id, id));
  } else if (kind === "academic_year") {
    await db.update(academicYears).set({ label: name }).where(eq(academicYears.id, id));
  } else {
    await db.update(semesters).set({ label: name }).where(eq(semesters.id, id));
  }

  await audit(
    admin.id,
    `${kind}.rename`,
    kind,
    id,
    `Renamed “${target.name}” to “${name}” (slug ${target.slug} kept)`,
  );

  refresh(["/admin", "/admin/taxonomy", "/explore", "/categories", "/technologies"]);

  return { info: `Renamed to “${name}”. The URL slug is unchanged.` };
}

export async function toggleTaxonomyActiveAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  const kindValue = field(formData, "kind");
  const id = idOf(formData, "id");
  if (!isTaxonomyKind(kindValue)) {
    return { error: "Unknown taxonomy list." };
  }
  const kind: TaxonomyKind = kindValue;

  if (kind === "academic_year" || kind === "semester") {
    return { error: "This list has no active flag — delete the entry instead." };
  }

  const target = await getTaxonomyTarget(kind, id);
  if (!target) return { error: "That entry no longer exists." };
  const active = !target.active;

  if (kind === "department") {
    await db
      .update(departments)
      .set({ active })
      .where(eq(departments.id, id));
  } else if (kind === "category") {
    await db.update(categories).set({ active }).where(eq(categories.id, id));
  } else {
    await db.update(technologies).set({ active }).where(eq(technologies.id, id));
  }

  await audit(
    admin.id,
    active ? `${kind}.activate` : `${kind}.deactivate`,
    kind,
    id,
    `${active ? "Activated" : "Deactivated"} “${target.name}”`,
  );

  refresh(["/admin", "/admin/taxonomy", "/explore", "/categories", "/technologies"]);

  return {
    info: active
      ? `“${target.name}” is available again.`
      : `“${target.name}” is hidden from new submissions.`,
  };
}

export async function deleteTaxonomyItemAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  const kindValue = field(formData, "kind");
  const id = idOf(formData, "id");
  if (!isTaxonomyKind(kindValue)) {
    return { error: "Unknown taxonomy list." };
  }
  const kind: TaxonomyKind = kindValue;

  const target = await getTaxonomyTarget(kind, id);
  if (!target) return { error: "That entry no longer exists." };

  // Check references first: a foreign-key crash is never a usable error.
  const usage = await countTaxonomyUsage(kind, id);
  if (usage > 0) {
    return {
      error: `“${target.name}” is still referenced by ${usagePhrase(kind, usage)}. Reassign or deactivate it instead of deleting it.`,
    };
  }

  if (kind === "department") {
    await db.delete(departments).where(eq(departments.id, id));
  } else if (kind === "category") {
    await db.delete(categories).where(eq(categories.id, id));
  } else if (kind === "technology") {
    await db.delete(technologies).where(eq(technologies.id, id));
  } else if (kind === "academic_year") {
    await db.delete(academicYears).where(eq(academicYears.id, id));
  } else {
    await db.delete(semesters).where(eq(semesters.id, id));
  }

  await audit(
    admin.id,
    `${kind}.delete`,
    kind,
    id,
    `Deleted “${target.name}” (${target.slug})`,
  );

  refresh(["/admin", "/admin/taxonomy", "/explore", "/categories", "/technologies"]);

  return { info: `“${target.name}” was deleted.` };
}

/* ------------------------------------------------------------------ */
/* Platform settings                                                   */
/* ------------------------------------------------------------------ */

const DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

const ANNOUNCEMENT_MAX = 400;

const settingsSchema = z.object({
  allowedEmailDomains: z.string().max(400, "That list of domains is too long."),
  siteAnnouncement: z.string().max(
    ANNOUNCEMENT_MAX,
    `Keep the announcement under ${ANNOUNCEMENT_MAX} characters.`,
  ),
});

export async function savePlatformSettingsAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  const moderationEnabled = formData.get("moderationEnabled") === "on";
  const requireEmailVerification = formData.get("requireEmailVerification") === "on";
  const rawDomains = field(formData, "allowedEmailDomains");
  const announcement = field(formData, "siteAnnouncement");

  const values = {
    allowedEmailDomains: rawDomains,
    siteAnnouncement: announcement,
    moderationEnabled: moderationEnabled ? "on" : "",
    requireEmailVerification: requireEmailVerification ? "on" : "",
  };

  const parsed = settingsSchema.safeParse({ allowedEmailDomains: rawDomains, siteAnnouncement: announcement });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors, values };
  }

  const domains = rawDomains
    .split(/[,\s]+/)
    .map((entry) => entry.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);

  const invalid = domains.filter((entry) => !DOMAIN_PATTERN.test(entry));
  if (invalid.length > 0) {
    return {
      fieldErrors: {
        allowedEmailDomains: `Not a valid domain: ${invalid.join(", ")}. Use entries like student.prolib.edu.`,
      },
      values,
    };
  }

  const previousDomains = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SETTING_KEYS.allowedEmailDomains))
    .limit(1);

  await Promise.all([
    setSetting(
      SETTING_KEYS.moderationEnabled,
      moderationEnabled ? "true" : "false",
    ),
    setSetting(
      SETTING_KEYS.requireEmailVerification,
      requireEmailVerification ? "true" : "false",
    ),
    setSetting(SETTING_KEYS.allowedEmailDomains, domains.join(",")),
    setSetting(SETTING_KEYS.siteAnnouncement, announcement),
  ]);

  await audit(
    admin.id,
    "settings.update",
    "settings",
    null,
    [
      `moderation=${moderationEnabled ? "on" : "off"}`,
      `email verification=${requireEmailVerification ? "on" : "off"}`,
      `domains=${domains.join(",") || "(any)"}`,
      `announcement=${announcement ? "updated" : "cleared"}`,
      previousDomains[0] && previousDomains[0].value !== domains.join(",")
        ? `was=${previousDomains[0].value || "(any)"}`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
  );

  // Settings change what the whole public site is allowed to show.
  refresh(["/", "/admin", "/admin/settings", "/admin/projects", "/explore"]);

  return {
    info: "Platform settings saved.",
    values: {
      allowedEmailDomains: domains.join(", "),
      siteAnnouncement: announcement,
      moderationEnabled: moderationEnabled ? "on" : "",
      requireEmailVerification: requireEmailVerification ? "on" : "",
    },
  };
}
