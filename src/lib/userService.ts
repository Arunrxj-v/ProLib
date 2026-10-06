import "server-only";

import { eq } from "drizzle-orm";

import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { departments, users } from "@/lib/db/schema";
import { UploadError, saveUpload } from "@/lib/storage";
import { blankToNull, fieldErrorsOf, profileSchema } from "@/lib/validation/projects";

/**
 * Profile updates as a service: the dashboard form (`updateProfileAction`)
 * and `PATCH /api/users/me` both run this exact logic, so username
 * uniqueness, the conditional department rule and skill parsing can never
 * diverge between surfaces.
 */
export type ServiceResult =
  | { ok: true; info?: string; username?: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export type ProfileInput = {
  name: string;
  username: string;
  headline?: string | null;
  bio?: string | null;
  departmentId?: string | null;
  /** Form sends a string; JSON clients may send a number. */
  batch: string | number;
  skills?: string | null;
  githubUsername?: string | null;
  portfolioUrl?: string | null;
  location?: string | null;
  /** Optional avatar upload — applied after the profile row is written. */
  avatar?: File | null;
};

export async function updateProfileFor(
  user: SessionUser,
  input: ProfileInput,
): Promise<ServiceResult> {
  const parsed = profileSchema.safeParse({
    name: input.name,
    username: input.username,
    headline: input.headline ?? null,
    bio: input.bio ?? null,
    departmentId: input.departmentId ?? null,
    batch:
      typeof input.batch === "number" ? String(input.batch) : (input.batch ?? ""),
    skills: input.skills ?? null,
    githubUsername: input.githubUsername ?? null,
    portfolioUrl: input.portfolioUrl ?? null,
    location: input.location ?? null,
  });

  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  // Department is required once the campus actually has departments. On a
  // brand-new instance the table is empty and there is nothing to pick, so we
  // don't block the student — empty database must stay usable.
  if (!parsed.data.departmentId) {
    const configured = await db
      .select({ id: departments.id })
      .from(departments)
      .limit(1);
    if (configured.length > 0) {
      return { ok: false, fieldErrors: { departmentId: "Choose your department." } };
    }
  }

  const clash = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, parsed.data.username))
    .limit(1);
  if (clash[0] && clash[0].id !== user.id) {
    return { ok: false, fieldErrors: { username: "That handle is taken." } };
  }

  const skills = (parsed.data.skills ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);

  await db
    .update(users)
    .set({
      name: parsed.data.name,
      username: parsed.data.username,
      headline: blankToNull(parsed.data.headline),
      bio: blankToNull(parsed.data.bio),
      departmentId: parsed.data.departmentId || null,
      batch: parsed.data.batch ?? null,
      skills,
      githubUsername: blankToNull(parsed.data.githubUsername),
      portfolioUrl: blankToNull(parsed.data.portfolioUrl),
      location: blankToNull(parsed.data.location),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  if (input.avatar && input.avatar.size > 0) {
    try {
      const stored = await saveUpload(input.avatar, "avatars");
      await db
        .update(users)
        .set({ avatarUrl: stored.path, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    } catch (cause) {
      return {
        ok: false,
        error:
          cause instanceof UploadError ? cause.message : "The photo upload failed.",
      };
    }
  }

  return { ok: true, info: "Profile saved.", username: parsed.data.username };
}
