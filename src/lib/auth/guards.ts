import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import type { Project } from "@/lib/db/schema";

import { getCurrentUser, type SessionUser } from "./session";

/**
 * Redirects an anonymous visitor to the sign-in screen.
 *
 * The destination prefers `x-prolib-path` — the exact path+query the proxy
 * forwarded (so a guard running in a *layout* still preserves a deep link
 * like /dashboard/projects/new in ?next=) — and falls back to the caller's
 * explicit `next` when the header is absent.
 */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const headerNext = (await headers()).get("x-prolib-path");
    const target = headerNext ?? next;
    redirect(target ? `/login?next=${encodeURIComponent(target)}` : "/login");
  }
  return user;
}

/** Elevated guard for /admin. Students are bounced back to their dashboard. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/dashboard?denied=1");
  return user;
}

/**
 * Backend authorization — never trust the client.
 * Owners and administrators may edit a project; nobody else.
 */
export async function getEditableProject(
  projectId: string,
  user: SessionUser,
): Promise<Project | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return null;
  if (user.role === "admin" || project.ownerId === user.id) return project;
  return null;
}

/** Same rule, but throws a 404 instead of returning null (for pages). */
export async function requireProjectEditor(
  projectId: string,
  user: SessionUser,
): Promise<Project> {
  const project = await getEditableProject(projectId, user);
  if (!project) redirect("/dashboard/projects?denied=1");
  return project;
}
