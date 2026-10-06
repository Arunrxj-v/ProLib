import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import {
  apiError,
  handleApiError,
  requireApiUser,
  validationResponse,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { SOCIAL_PROVIDERS, type SocialProvider } from "@/lib/constants";
import { db } from "@/lib/db";
import { socialLinks } from "@/lib/db/schema";
import { updateProfileFor } from "@/lib/userService";
import { socialSchema } from "@/lib/validation/projects";

export const dynamic = "force-dynamic";

async function loadSocials(userId: string) {
  return db
    .select({ provider: socialLinks.provider, url: socialLinks.url })
    .from(socialLinks)
    .where(eq(socialLinks.userId, userId));
}

/**
 * `GET /api/users/me` — the signed-in student's full own-profile record.
 * Password material never leaves the session layer.
 */
export async function GET() {
  try {
    const user = await requireApiUser();
    const socials = await loadSocials(user.id);
    return Response.json({ user, socials });
  } catch (error) {
    return handleApiError(error);
  }
}

const PROFILE_KEYS = [
  "name",
  "username",
  "headline",
  "bio",
  "departmentId",
  "batch",
  "skills",
  "githubUsername",
  "portfolioUrl",
  "location",
] as const;

/**
 * `PATCH /api/users/me` — partial profile update (§12).
 *
 * Accepts JSON or multipart (for an avatar file). Unspecified fields keep
 * their current values; the same validation rules as the dashboard form
 * apply (unique handle, conditional department, batch range). An optional
 * `socials: [{ provider, url }]` array replaces the set of connected
 * links — icons only ever render from rows that exist.
 */
export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();

    let body: Record<string, unknown> = {};
    let avatar: File | null = null;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const key of PROFILE_KEYS) {
        const value = form.get(key);
        if (typeof value === "string") body[key] = value;
      }
      const file = form.get("avatar");
      if (file instanceof File && file.size > 0) avatar = file;
      const socialsValue = form.get("socials");
      if (typeof socialsValue === "string" && socialsValue.trim()) {
        try {
          body.socials = JSON.parse(socialsValue);
        } catch {
          return apiError(400, "Bad Request", "socials must be a JSON array.");
        }
      }
    } else {
      const parsed = await request.json().catch(() => null);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return apiError(400, "Bad Request", "Expected a JSON object body.");
      }
      body = parsed as Record<string, unknown>;
    }

    // Merge with the current record so omitted fields stay unchanged.
    const current: Record<string, unknown> = {
      name: user.name,
      username: user.username ?? "",
      headline: user.headline ?? null,
      bio: user.bio ?? null,
      departmentId: user.departmentId ?? null,
      batch: user.batch ?? "",
      skills: (user.skills ?? []).join(", "),
      githubUsername: user.githubUsername ?? null,
      portfolioUrl: user.portfolioUrl ?? null,
      location: user.location ?? null,
    };
    const merged: Record<string, unknown> = { ...current };
    for (const key of PROFILE_KEYS) {
      if (body[key] !== undefined) merged[key] = body[key];
    }

    const result = await updateProfileFor(user, {
      name: String(merged.name ?? ""),
      username: String(merged.username ?? ""),
      headline: (merged.headline as string | null) ?? null,
      bio: (merged.bio as string | null) ?? null,
      departmentId: (merged.departmentId as string | null) ?? null,
      batch: (merged.batch as string | number) ?? "",
      skills: (merged.skills as string | null) ?? null,
      githubUsername: (merged.githubUsername as string | null) ?? null,
      portfolioUrl: (merged.portfolioUrl as string | null) ?? null,
      location: (merged.location as string | null) ?? null,
      avatar,
    });

    if (!result.ok) {
      if (result.fieldErrors) return validationResponse(result.fieldErrors);
      return apiError(400, "Bad Request", result.error ?? "The profile could not be saved.");
    }

    // Optional full replacement of social links.
    if (body.socials !== undefined) {
      if (!Array.isArray(body.socials)) {
        return apiError(400, "Bad Request", "socials must be an array.");
      }
      const known = new Set<string>(SOCIAL_PROVIDERS.map((item) => item.value));
      const links: Array<{ provider: SocialProvider; url: string }> = [];
      const fieldErrors: Record<string, string> = {};

      for (const [index, entry] of body.socials.entries()) {
        const record = (entry ?? null) as Record<string, unknown> | null;
        const provider = typeof record?.provider === "string" ? record.provider : "";
        const url = typeof record?.url === "string" ? record.url : "";

        if (!known.has(provider)) {
          fieldErrors[`socials.${index}.provider`] = "Choose a network from the list.";
          continue;
        }
        const parsed = socialSchema.safeParse({ provider, url });
        if (!parsed.success) {
          fieldErrors[`socials.${index}.url`] = "Enter a full http(s) link.";
          continue;
        }
        links.push({ provider: provider as SocialProvider, url: parsed.data.url });
      }

      if (Object.keys(fieldErrors).length > 0) {
        return validationResponse(fieldErrors);
      }

      await db.delete(socialLinks).where(eq(socialLinks.userId, user.id));
      if (links.length > 0) {
        await db.insert(socialLinks).values(
          links.map((link) => ({
            id: crypto.randomUUID(),
            userId: user.id,
            provider: link.provider,
            url: link.url,
          })),
        );
      }
    }

    revalidatePath("/dashboard/profile");
    if (result.username) revalidatePath(`/students/${result.username}`);

    const fresh = await getCurrentUser();
    const socials = await loadSocials(user.id);
    return Response.json({ user: fresh ?? user, socials });
  } catch (error) {
    return handleApiError(error);
  }
}
