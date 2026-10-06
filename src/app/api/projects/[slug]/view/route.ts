import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { getPublicStatuses, recordProjectView } from "@/lib/data/projects";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** One counted view per browser per hour, per project. */
const COOLDOWN_MS = 60 * 60 * 1000;

/**
 * View beacon posted by `ViewBeacon`.
 *
 * Only projects that are actually visible in the public library accept a hit,
 * so a leaked slug for a draft cannot inflate anything.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const [row] = await db
    .select({ id: projects.id, publicationStatus: projects.publicationStatus })
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);

  if (!row) return new Response(null, { status: 404 });

  const statuses = await getPublicStatuses();
  if (!statuses.includes(row.publicationStatus)) {
    return new Response(null, { status: 404 });
  }

  const cookieStore = await cookies();
  const cookieName = `prolib_view_${row.id.replace(/-/g, "").slice(0, 16)}`;
  const last = Number(cookieStore.get(cookieName)?.value ?? 0);

  if (Date.now() - last > COOLDOWN_MS) {
    await recordProjectView(row.id);
    cookieStore.set(cookieName, String(Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOLDOWN_MS / 1000,
    });
  }

  return new Response(null, { status: 204 });
}
