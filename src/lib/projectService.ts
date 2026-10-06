import "server-only";

import { count, eq, inArray, ne } from "drizzle-orm";
import { and } from "drizzle-orm";
import { z } from "zod";

import { getEditableProject } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import {
  PROJECT_SECTION_KEYS,
  type ProjectLifecycleStatus,
  type ProjectSectionKey,
  type ProjectType,
} from "@/lib/constants";
import { db } from "@/lib/db";
import {
  auditLogs,
  projectImages,
  projectMembers,
  projectSections,
  projectTechnologies,
  projects,
  technologies,
  users,
  type Project,
} from "@/lib/db/schema";
import { associateGithubRepository } from "@/lib/github";
import { isModerationEnabled } from "@/lib/settings";
import { UploadError, removeUpload, saveUpload } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import {
  blankToNull,
  fieldErrorsOf,
  memberSchema,
  projectFormSchema,
} from "@/lib/validation/projects";

/**
 * Single source of truth for every project mutation.
 *
 * The server actions (dashboard forms) and the REST endpoints
 * (`/api/projects...`) both call into this module, so authorization rules,
 * validation and audit behaviour can never drift between the two surfaces.
 */
export type ServiceResult =
  | { ok: true; info?: string; projectId?: string }
  | {
      ok: false;
      error?: string;
      info?: string;
      fieldErrors?: Record<string, string>;
      /** True when the failure is a state conflict (HTTP 409). */
      conflict?: boolean;
    };

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

/** Flattens a service result into the action-state shape the forms expect. */
export function toOptional(result: ServiceResult): {
  error?: string;
  info?: string;
  fieldErrors?: Record<string, string>;
} {
  if (result.ok) return { info: result.info };
  return {
    ...(result.error !== undefined ? { error: result.error } : {}),
    ...(result.info !== undefined ? { info: result.info } : {}),
    ...(result.fieldErrors !== undefined ? { fieldErrors: result.fieldErrors } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export async function audit(
  actorId: string,
  action: string,
  entityId: string,
  detail: string,
) {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorId,
    action,
    entity: "project",
    entityId,
    detail,
  });
}

export async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title) || "project";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        excludeId
          ? and(eq(projects.slug, candidate), ne(projects.id, excludeId))
          : eq(projects.slug, candidate),
      )
      .limit(1);
    if (rows.length === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export type SectionInput = {
  key: string;
  title?: string | null;
  content?: string | null;
  visible?: boolean;
};

export async function syncSections(projectId: string, sections: SectionInput[]) {
  for (const section of sections) {
    if (!section.content) {
      await db
        .delete(projectSections)
        .where(
          and(
            eq(projectSections.projectId, projectId),
            eq(projectSections.key, section.key as ProjectSectionKey),
          ),
        );
      continue;
    }

    await db
      .insert(projectSections)
      .values({
        id: crypto.randomUUID(),
        projectId,
        key: section.key as ProjectSectionKey,
        title: section.title ?? null,
        content: section.content,
        position: PROJECT_SECTION_KEYS.findIndex((item) => item.value === section.key),
        visible: section.visible ?? true,
      })
      .onConflictDoUpdate({
        target: [projectSections.projectId, projectSections.key],
        set: {
          title: section.title ?? null,
          content: section.content,
          visible: section.visible ?? true,
          updatedAt: new Date(),
        },
      });
  }
}

/**
 * Links the technologies a student picked (existing rows) and the ones they
 * typed in (created on the fly, so a brand-new instance with an empty
 * technologies table is still fully usable). Idempotent: custom names are
 * upserted by slug, so re-submitting the same edit never duplicates a row.
 */
export async function syncTechnologies(
  projectId: string,
  technologyIds: string[],
  technologyNames: string[] = [],
) {
  const uniqueIds = [...new Set(technologyIds)].filter(Boolean);
  const uniqueNames = [
    ...new Map(
      technologyNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0 && name.length <= 40)
        .map((name) => [name.toLowerCase(), name] as const),
    ).values(),
  ];

  await db.delete(projectTechnologies).where(eq(projectTechnologies.projectId, projectId));
  if (uniqueIds.length === 0 && uniqueNames.length === 0) return;

  // Create whatever the student typed that doesn't exist yet.
  const entries = uniqueNames
    .map((name) => ({ name, slug: slugify(name) }))
    .filter((entry) => entry.slug.length > 0);
  const slugs = entries.map((entry) => entry.slug);
  if (entries.length > 0) {
    await db
      .insert(technologies)
      .values(
        entries.map((entry) => ({
          id: crypto.randomUUID(),
          name: entry.name,
          slug: entry.slug,
          kind: "other",
        })),
      )
      .onConflictDoNothing({ target: technologies.slug });
  }

  // Resolve every technology to a real id (picked + typed) before linking.
  const wantedIds = new Set(uniqueIds);
  if (slugs.length > 0) {
    const created = await db
      .select({ id: technologies.id })
      .from(technologies)
      .where(inArray(technologies.slug, slugs));
    for (const row of created) wantedIds.add(row.id);
  }

  const valid = wantedIds.size
    ? await db
        .select({ id: technologies.id })
        .from(technologies)
        .where(inArray(technologies.id, [...wantedIds]))
    : [];

  const rows = valid.map((row) => ({ projectId, technologyId: row.id }));
  if (rows.length > 0) {
    await db.insert(projectTechnologies).values(rows);
  }
}

/** Owner-or-admin gate shared by every mutation (never trust the client). */
async function editableProject(
  actor: SessionUser,
  projectId: string,
): Promise<{ ok: true; project: Project } | { ok: false; result: ServiceResult }> {
  const project = await getEditableProject(projectId, actor);
  if (!project) {
    return {
      ok: false,
      result: { ok: false, error: "You can only change your own projects." },
    };
  }
  return { ok: true, project };
}

async function loadProject(projectId: string): Promise<Project | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Create / update / delete                                            */
/* ------------------------------------------------------------------ */

export type CreateProjectInput = {
  values: ProjectFormValues;
  technologyIds?: string[];
  technologyNames?: string[];
  cover?: File | null;
  /** Mirrors the wizard's hidden intent field: save draft vs go live now. */
  intent?: "draft" | "publish";
};

export type ProjectOutcome = ServiceResult & { project?: Project };

export async function createProjectFor(
  user: SessionUser,
  input: CreateProjectInput,
): Promise<ProjectOutcome> {
  const { values } = input;
  const technologyIds = [...new Set(input.technologyIds ?? [])].filter(Boolean);
  const technologyNames = input.technologyNames ?? [];

  if (
    technologyIds.length === 0 &&
    technologyNames.filter((name) => name.trim()).length === 0
  ) {
    return { ok: false, fieldErrors: { technologies: "Add at least one technology." } };
  }

  const cover = input.cover && input.cover.size > 0 ? input.cover : null;
  if (!cover) {
    return { ok: false, fieldErrors: { cover: "Add a cover image for the project." } };
  }

  let stored: Awaited<ReturnType<typeof saveUpload>>;
  try {
    stored = await saveUpload(cover, "projects");
  } catch (error) {
    if (error instanceof UploadError) {
      return { ok: false, fieldErrors: { cover: error.message } };
    }
    throw error;
  }

  const publishNow = input.intent === "publish";
  const moderation = await isModerationEnabled();
  const now = new Date();

  const projectId = crypto.randomUUID();
  const slug = await uniqueSlug(values.title);
  // Real repository association (§23) — GitHub stays the source of truth.
  const githubRepositoryId = await associateGithubRepository(values.githubUrl, user.id);

  try {
    await db.insert(projects).values({
      id: projectId,
      slug,
      ownerId: user.id,
      title: values.title,
      shortDescription: values.shortDescription,
      description: values.description ?? null,
      projectType: values.projectType as ProjectType,
      status: values.status as ProjectLifecycleStatus,
      publicationStatus: publishNow
        ? moderation
          ? "submitted"
          : "published"
        : "draft",
      submittedAt: publishNow ? now : null,
      publishedAt: publishNow && !moderation ? now : null,
      coverImage: stored.path,
      githubUrl: blankToNull(values.githubUrl),
      githubRepositoryId,
      demoUrl: blankToNull(values.demoUrl),
    });

    await db.insert(projectMembers).values({
      projectId,
      userId: user.id,
      role: "Owner",
      isOwner: true,
      position: 0,
    });

    await syncSections(projectId, []);
    await syncTechnologies(projectId, technologyIds, technologyNames);
    await audit(user.id, "project.create", projectId, values.title);
    if (publishNow) {
      await audit(
        user.id,
        moderation ? "project.submit" : "project.publish",
        projectId,
        values.title,
      );
    }
  } catch (error) {
    // Never orphan the uploaded file if the row could not be written.
    await removeUpload(stored.path).catch(() => undefined);
    throw error;
  }

  const project = await loadProject(projectId);
  return {
    ok: true,
    project: project ?? undefined,
    info: publishNow
      ? moderation
        ? "Submitted for review — a moderator will pick it up next."
        : "Published — your project is live in the library."
      : "Draft saved.",
  };
}

export type UpdateProjectInput = {
  values: ProjectFormValues;
  /** Omit both to leave the technology links untouched; [] clears them. */
  technologyIds?: string[];
  technologyNames?: string[];
  /** Omit to leave narrative sections untouched. */
  sections?: SectionInput[];
  cover?: File | null;
  removeCover?: boolean;
  galleryFiles?: File[];
};

export async function updateProjectFor(
  actor: SessionUser,
  project: Project,
  input: UpdateProjectInput,
): Promise<ProjectOutcome> {
  const { values } = input;

  // The slug only follows the title while the project is still a draft —
  // published URLs must stay stable.
  const slug =
    project.publicationStatus === "draft"
      ? await uniqueSlug(values.title, project.id)
      : project.slug;

  const githubRepositoryId = await associateGithubRepository(values.githubUrl);

  await db
    .update(projects)
    .set({
      title: values.title,
      slug,
      shortDescription: values.shortDescription,
      description: values.description ?? null,
      projectType: values.projectType as ProjectType,
      status: values.status as ProjectLifecycleStatus,
      departmentId: values.departmentId || null,
      categoryId: values.categoryId || null,
      academicYearId: values.academicYearId || null,
      semesterId: values.semesterId || null,
      githubUrl: blankToNull(values.githubUrl),
      githubRepositoryId,
      demoUrl: blankToNull(values.demoUrl),
      docsUrl: blankToNull(values.docsUrl),
      videoUrl: blankToNull(values.videoUrl),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id));

  if (input.sections) await syncSections(project.id, input.sections);
  if (input.technologyIds || input.technologyNames) {
    await syncTechnologies(
      project.id,
      input.technologyIds ?? [],
      input.technologyNames ?? [],
    );
  }

  if (input.removeCover && project.coverImage) {
    await removeUpload(project.coverImage);
    await db
      .update(projects)
      .set({ coverImage: null })
      .where(eq(projects.id, project.id));
  }

  if (input.cover && input.cover.size > 0) {
    try {
      const stored = await saveUpload(input.cover, "projects");
      await removeUpload(project.coverImage);
      await db
        .update(projects)
        .set({ coverImage: stored.path })
        .where(eq(projects.id, project.id));
    } catch (cause) {
      return {
        ok: false,
        error:
          cause instanceof UploadError ? cause.message : "The cover upload failed.",
      };
    }
  }

  for (const file of input.galleryFiles ?? []) {
    if (!(file instanceof File) || file.size === 0) continue;
    try {
      const stored = await saveUpload(file, "galleries");
      const positionRows = await db
        .select({ value: count() })
        .from(projectImages)
        .where(eq(projectImages.projectId, project.id));
      await db.insert(projectImages).values({
        id: crypto.randomUUID(),
        projectId: project.id,
        path: stored.path,
        alt: values.title,
        position: Number(positionRows[0]?.value ?? 0),
      });
    } catch (cause) {
      return {
        ok: false,
        error: cause instanceof UploadError ? cause.message : "A gallery upload failed.",
      };
    }
  }

  await audit(actor.id, "project.update", project.id, values.title);
  const updated = await loadProject(project.id);
  return { ok: true, project: updated ?? undefined, info: "Project saved." };
}

export async function deleteProjectFor(
  actor: SessionUser,
  project: Project,
): Promise<ServiceResult> {
  if (project.coverImage) await removeUpload(project.coverImage);
  const imageRows = await db
    .select({ path: projectImages.path })
    .from(projectImages)
    .where(eq(projectImages.projectId, project.id));
  for (const row of imageRows) await removeUpload(row.path);

  await db.delete(projects).where(eq(projects.id, project.id));
  await audit(actor.id, "project.delete", project.id, project.title);
  return { ok: true, info: "Project deleted." };
}

/* ------------------------------------------------------------------ */
/* Publishing workflow                                                 */
/* ------------------------------------------------------------------ */

export async function publishProjectFor(
  actor: SessionUser,
  project: Project,
): Promise<ServiceResult> {
  const moderation = await isModerationEnabled();

  if (!["draft", "rejected"].includes(project.publicationStatus)) {
    return {
      ok: false,
      error: moderation
        ? "This project is already in the review pipeline."
        : "This project is already live in the library.",
    };
  }

  // Only a real title and a one-line summary are required to go live.
  const missing: string[] = [];
  if (project.title.trim().length < 4) missing.push("a title");
  if (project.shortDescription.trim().length < 20) missing.push("a short summary");
  if (missing.length > 0) {
    return {
      ok: false,
      error: moderation
        ? "This project is not ready for review yet."
        : "This project is not ready to publish yet.",
      info: `Still missing: ${missing.join(", ")}.`,
    };
  }

  const now = new Date();
  if (moderation) {
    await db
      .update(projects)
      .set({
        publicationStatus: "submitted",
        submittedAt: now,
        reviewNote: null,
        updatedAt: now,
      })
      .where(eq(projects.id, project.id));
  } else {
    await db
      .update(projects)
      .set({
        publicationStatus: "published",
        submittedAt: now,
        publishedAt: project.publishedAt ?? now,
        reviewNote: null,
        updatedAt: now,
      })
      .where(eq(projects.id, project.id));
  }

  await audit(
    actor.id,
    moderation ? "project.submit" : "project.publish",
    project.id,
    project.title,
  );
  return {
    ok: true,
    info: moderation
      ? "Submitted for review — a moderator will pick it up next."
      : "Published — your project is live in the library.",
  };
}

export async function withdrawProjectFor(
  actor: SessionUser,
  project: Project,
): Promise<ServiceResult> {
  const moderation = await isModerationEnabled();

  if (
    !["submitted", "in_review", "rejected", "published"].includes(
      project.publicationStatus,
    )
  ) {
    return {
      ok: false,
      error: moderation
        ? "Only submitted, in-review or rejected work can be recalled."
        : "This project is already a draft.",
    };
  }

  await db
    .update(projects)
    .set({
      publicationStatus: "draft",
      submittedAt: null,
      publishedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id));

  await audit(actor.id, "project.withdraw", project.id, project.title);
  return {
    ok: true,
    info: moderation
      ? "Recalled — the project is back in your drafts."
      : "Unpublished — the project is back in your drafts.",
  };
}

/* ------------------------------------------------------------------ */
/* Gallery                                                             */
/* ------------------------------------------------------------------ */

export async function addGalleryImagesFor(
  actor: SessionUser,
  project: Project,
  files: File[],
): Promise<ServiceResult> {
  if (files.length === 0) {
    return { ok: false, error: "Choose at least one image to upload." };
  }

  try {
    const positionRows = await db
      .select({ value: count() })
      .from(projectImages)
      .where(eq(projectImages.projectId, project.id));
    let position = Number(positionRows[0]?.value ?? 0);

    for (const file of files) {
      const stored = await saveUpload(file, "galleries");
      await db.insert(projectImages).values({
        id: crypto.randomUUID(),
        projectId: project.id,
        path: stored.path,
        alt: project.title,
        position: position++,
      });
      await audit(actor.id, "project.gallery.add", project.id, stored.path);
    }
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof UploadError ? cause.message : "The upload failed.",
    };
  }

  return { ok: true, info: "Image added to the gallery." };
}

export async function removeGalleryImageFor(
  actor: SessionUser,
  imageId: string,
  expectedProjectId?: string,
): Promise<ServiceResult> {
  const rows = await db
    .select({
      id: projectImages.id,
      projectId: projectImages.projectId,
      path: projectImages.path,
    })
    .from(projectImages)
    .where(eq(projectImages.id, imageId))
    .limit(1);

  const image = rows[0];
  if (!image || (expectedProjectId && image.projectId !== expectedProjectId)) {
    return { ok: false, error: "That image no longer exists." };
  }

  const gate = await editableProject(actor, image.projectId);
  if (!gate.ok) return gate.result;

  await removeUpload(image.path);
  await db.delete(projectImages).where(eq(projectImages.id, imageId));
  await audit(actor.id, "project.gallery.remove", image.projectId, image.path);
  return { ok: true, info: "Image removed.", projectId: image.projectId };
}

/* ------------------------------------------------------------------ */
/* Team (real membership rows — never free-text names)                 */
/* ------------------------------------------------------------------ */

export async function addMemberFor(
  actor: SessionUser,
  project: Project,
  input: { username?: string; userId?: string; role?: string },
): Promise<ServiceResult> {
  let role = input.role ?? "Member";
  let targetRow: { id: string; name: string; status: string } | undefined;

  if (input.userId) {
    const rows = await db
      .select({ id: users.id, name: users.name, status: users.status })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    targetRow = rows[0];
    if (!targetRow) return { ok: false, error: "No student with that id." };
  } else {
    const parsed = memberSchema.safeParse({
      username: input.username ?? "",
      role,
    });
    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
    }
    role = parsed.data.role;

    const rows = await db
      .select({ id: users.id, name: users.name, status: users.status })
      .from(users)
      .where(eq(users.username, parsed.data.username.toLowerCase()))
      .limit(1);
    targetRow = rows[0];
    if (!targetRow) {
      return { ok: false, fieldErrors: { username: "No student uses that handle." } };
    }
  }

  const teammate = targetRow;
  if (teammate.status !== "active") {
    return { ok: false, error: "That account cannot join teams right now." };
  }
  if (teammate.id === actor.id) {
    return { ok: false, error: "You already own this project." };
  }

  const existing = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, teammate.id)),
    )
    .limit(1);
  if (existing[0]) {
    return {
      ok: false,
      error: "That student is already on this team.",
      conflict: true,
    };
  }

  const positionRows = await db
    .select({ value: count() })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, project.id));

  await db.insert(projectMembers).values({
    projectId: project.id,
    userId: teammate.id,
    role,
    isOwner: false,
    position: Number(positionRows[0]?.value ?? 0),
  });

  await audit(actor.id, "project.member.add", project.id, teammate.id);
  return { ok: true, info: `${teammate.name} was added to the team.` };
}

export async function removeMemberFor(
  actor: SessionUser,
  project: Project,
  memberId: string,
): Promise<ServiceResult> {
  const rows = await db
    .select({ isOwner: projectMembers.isOwner })
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, memberId)),
    )
    .limit(1);

  if (!rows[0]) return { ok: false, error: "That student is not on this team." };
  if (rows[0].isOwner) {
    return { ok: false, error: "The owner cannot be removed from their own project." };
  }

  await db
    .delete(projectMembers)
    .where(
      and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, memberId)),
    );

  await audit(actor.id, "project.member.remove", project.id, memberId);
  return { ok: true, info: "Teammate removed." };
}
