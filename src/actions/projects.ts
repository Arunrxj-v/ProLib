"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { getEditableProject } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import {
  PROJECT_SECTION_KEYS,
  SOCIAL_PROVIDERS,
  type ProjectSectionKey,
  type SocialProvider,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { socialLinks, type Project } from "@/lib/db/schema";
import {
  addGalleryImagesFor,
  addMemberFor,
  createProjectFor,
  deleteProjectFor,
  publishProjectFor,
  removeGalleryImageFor,
  removeMemberFor,
  toOptional,
  updateProjectFor,
  withdrawProjectFor,
} from "@/lib/projectService";
import { updateProfileFor } from "@/lib/userService";
import {
  fieldErrorsOf,
  projectFormSchema,
  socialSchema,
} from "@/lib/validation/projects";

/**
 * Server actions for the dashboard forms.
 *
 * These are thin FormData adapters: every rule that matters (validation,
 * ownership, uploads, audit) lives in `@/lib/projectService` /
 * `@/lib/userService`, which the REST API shares — so the form surface and
 * the API can never disagree about what is allowed.
 */
export type ProjectActionState = {
  error?: string;
  info?: string;
  fieldErrors?: Record<string, string>;
};

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formValues(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string");
}

/** Owner-or-admin gate used by every mutation below. */
type OwnedGate =
  | { ok: false; state: ProjectActionState }
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; project: Project };

async function ownedProject(projectId: string): Promise<OwnedGate> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, state: { error: "Your session expired — sign in again." } };

  const project = await getEditableProject(projectId, user);
  if (!project) return { ok: false, state: { error: "You can only change your own projects." } };

  return { ok: true, user, project };
}

function readSections(formData: FormData) {
  return PROJECT_SECTION_KEYS.map((item) => ({
    key: item.value as ProjectSectionKey,
    title: item.label,
    content: formValue(formData, `section_${item.value}`) || null,
    visible: true,
  }));
}

function readSectionsField(formData: FormData) {
  return readSections(formData).map((section) => ({
    key: section.key,
    title: section.title,
    content: section.content,
    visible: section.visible,
  }));
}

/* ------------------------------------------------------------------ */
/* Create / update / delete                                            */
/* ------------------------------------------------------------------ */

export async function createProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session expired — sign in again." };

  const parsed = projectFormSchema.safeParse({
    title: formValue(formData, "title"),
    shortDescription: formValue(formData, "shortDescription"),
    projectType: formValue(formData, "projectType"),
    status: formValue(formData, "status") || "in_progress",
    // Everything below is optional detail that lives on the edit page.
    departmentId: null,
    categoryId: null,
    academicYearId: null,
    semesterId: null,
    description: formValue(formData, "description") || null,
    sections: [],
    githubUrl: formValue(formData, "githubUrl") || null,
    demoUrl: formValue(formData, "demoUrl") || null,
    docsUrl: null,
    videoUrl: null,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const coverField = formData.get("cover");
  const cover =
    coverField instanceof File && coverField.size > 0 ? coverField : null;

  const result = await createProjectFor(user, {
    values: parsed.data,
    technologyIds: formValues(formData, "technologyIds"),
    technologyNames: formValues(formData, "technologyNames"),
    cover,
    intent: formValue(formData, "intent") === "publish" ? "publish" : "draft",
  });
  if (!result.ok) return toOptional(result);

  const created = result.project;
  if (!created) return { error: "The project could not be loaded after saving." };

  const published =
    created.publicationStatus !== "draft"
      ? `&published=${created.publicationStatus === "submitted" ? "review" : "live"}`
      : "";

  revalidatePath("/dashboard/projects");
  redirect(`/dashboard/projects/${created.id}/edit?created=1${published}`);
}

export async function updateProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = formValue(formData, "projectId");
  const gate = await ownedProject(projectId);
  if (!gate.ok) return gate.state;

  const parsed = projectFormSchema.safeParse({
    title: formValue(formData, "title"),
    shortDescription: formValue(formData, "shortDescription"),
    projectType: formValue(formData, "projectType"),
    status: formValue(formData, "status"),
    departmentId: formValue(formData, "departmentId") || null,
    categoryId: formValue(formData, "categoryId") || null,
    academicYearId: formValue(formData, "academicYearId") || null,
    semesterId: formValue(formData, "semesterId") || null,
    description: formValue(formData, "description") || null,
    sections: readSectionsField(formData),
    githubUrl: formValue(formData, "githubUrl") || null,
    demoUrl: formValue(formData, "demoUrl") || null,
    docsUrl: formValue(formData, "docsUrl") || null,
    videoUrl: formValue(formData, "videoUrl") || null,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const cover = formData.get("cover");
  const gallery = formData.getAll("gallery").filter(
    (value): value is File => value instanceof File && value.size > 0,
  );

  const result = await updateProjectFor(gate.user, gate.project, {
    values: parsed.data,
    technologyIds: formValues(formData, "technologyIds"),
    technologyNames: formValues(formData, "technologyNames"),
    sections: readSectionsField(formData),
    cover: cover instanceof File && cover.size > 0 ? cover : null,
    removeCover: formValue(formData, "removeCover") === "on",
    galleryFiles: gallery,
  });
  if (!result.ok) return toOptional(result);

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${projectId}/edit`);
  revalidatePath(`/projects/${gate.project.slug}`);

  redirect(`/dashboard/projects/${projectId}/edit?saved=1`);
}

export async function deleteProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = formValue(formData, "projectId");
  const gate = await ownedProject(projectId);
  if (!gate.ok) return gate.state;

  const confirmTitle = formValue(formData, "confirm");
  if (confirmTitle !== gate.project.title) {
    return { error: "Type the project title exactly to confirm deletion." };
  }

  const result = await deleteProjectFor(gate.user, gate.project);
  if (!result.ok) return toOptional(result);

  revalidatePath("/dashboard/projects");
  redirect("/dashboard/projects?deleted=1");
}

/* ------------------------------------------------------------------ */
/* Publishing workflow                                                 */
/* ------------------------------------------------------------------ */

export async function submitProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = formValue(formData, "projectId");
  const gate = await ownedProject(projectId);
  if (!gate.ok) return gate.state;

  const result = await publishProjectFor(gate.user, gate.project);
  if (!result.ok) return toOptional(result);

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${projectId}/edit`);
  return { info: result.info };
}

export async function withdrawProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = formValue(formData, "projectId");
  const gate = await ownedProject(projectId);
  if (!gate.ok) return gate.state;

  const result = await withdrawProjectFor(gate.user, gate.project);
  if (!result.ok) return toOptional(result);

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${projectId}/edit`);
  return { info: result.info };
}

/* ------------------------------------------------------------------ */
/* Gallery                                                             */
/* ------------------------------------------------------------------ */

export async function uploadGalleryImageAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = formValue(formData, "projectId");
  const gate = await ownedProject(projectId);
  if (!gate.ok) return gate.state;

  const files = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);

  const result = await addGalleryImagesFor(gate.user, gate.project, files);
  if (!result.ok) return toOptional(result);

  revalidatePath(`/dashboard/projects/${projectId}/edit`);
  return { info: result.info };
}

export async function removeGalleryImageAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session expired — sign in again." };

  const imageId = formValue(formData, "imageId");
  const result = await removeGalleryImageFor(user, imageId);
  if (!result.ok) return toOptional(result);

  if (result.projectId) {
    revalidatePath(`/dashboard/projects/${result.projectId}/edit`);
  }
  return { info: result.info };
}

/* ------------------------------------------------------------------ */
/* Team                                                                */
/* ------------------------------------------------------------------ */

export async function addMemberAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = formValue(formData, "projectId");
  const gate = await ownedProject(projectId);
  if (!gate.ok) return gate.state;

  const result = await addMemberFor(gate.user, gate.project, {
    username: formValue(formData, "username"),
    role: formValue(formData, "role"),
  });
  if (!result.ok) return toOptional(result);

  revalidatePath(`/dashboard/projects/${projectId}/edit`);
  return { info: result.info };
}

export async function removeMemberAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = formValue(formData, "projectId");
  const gate = await ownedProject(projectId);
  if (!gate.ok) return gate.state;

  const memberId = formValue(formData, "userId");
  const result = await removeMemberFor(gate.user, gate.project, memberId);
  if (!result.ok) return toOptional(result);

  revalidatePath(`/dashboard/projects/${projectId}/edit`);
  return { info: result.info };
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export async function updateProfileAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session expired — sign in again." };

  const avatar = formData.get("avatar");
  const result = await updateProfileFor(user, {
    name: formValue(formData, "name"),
    username: formValue(formData, "username"),
    headline: formValue(formData, "headline") || null,
    bio: formValue(formData, "bio") || null,
    departmentId: formValue(formData, "departmentId") || null,
    batch: formValue(formData, "batch"),
    skills: formValue(formData, "skills") || null,
    githubUsername: formValue(formData, "githubUsername") || null,
    portfolioUrl: formValue(formData, "portfolioUrl") || null,
    location: formValue(formData, "location") || null,
    avatar: avatar instanceof File && avatar.size > 0 ? avatar : null,
  });

  if (!result.ok) {
    return {
      ...(result.error !== undefined ? { error: result.error } : {}),
      ...(result.fieldErrors !== undefined ? { fieldErrors: result.fieldErrors } : {}),
    };
  }

  revalidatePath("/dashboard/profile");
  if (result.username) revalidatePath(`/students/${result.username}`);
  return { info: result.info ?? "Profile saved." };
}

/* ------------------------------------------------------------------ */
/* Connected social accounts — only rows that actually exist render    */
/* ------------------------------------------------------------------ */

export async function upsertSocialLinkAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session expired — sign in again." };

  const parsed = socialSchema.safeParse({
    provider: formValue(formData, "provider"),
    url: formValue(formData, "url"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const known = SOCIAL_PROVIDERS.some(
    (item) => item.value === parsed.data.provider,
  );
  if (!known) return { fieldErrors: { provider: "Choose a network from the list." } };

  await db
    .insert(socialLinks)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      provider: parsed.data.provider as (typeof SOCIAL_PROVIDERS)[number]["value"],
      url: parsed.data.url,
    })
    .onConflictDoUpdate({
      target: [socialLinks.userId, socialLinks.provider],
      set: { url: parsed.data.url },
    });

  revalidatePath("/dashboard/profile");
  return { info: `${parsed.data.provider} link saved.` };
}

export async function removeSocialLinkAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session expired — sign in again." };

  const parsed = socialSchema.shape.provider.safeParse(formValue(formData, "provider"));
  if (!parsed.success) return { error: "Choose a network from the list." };
  if (!SOCIAL_PROVIDERS.some((item) => item.value === parsed.data)) {
    return { error: "Choose a network from the list." };
  }
  const provider = parsed.data as SocialProvider;

  await db
    .delete(socialLinks)
    .where(
      and(eq(socialLinks.userId, user.id), eq(socialLinks.provider, provider)),
    );

  revalidatePath("/dashboard/profile");
  return { info: "Link removed." };
}
