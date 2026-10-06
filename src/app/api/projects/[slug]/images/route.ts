import { eq } from "drizzle-orm";

import {
  apiError,
  handleApiError,
  requireApiUser,
  requireEditableProject,
  serviceError,
} from "@/lib/api";
import { db } from "@/lib/db";
import { projectImages } from "@/lib/db/schema";
import { addGalleryImagesFor } from "@/lib/projectService";

export const dynamic = "force-dynamic";

/**
 * `POST /api/projects/:id/images` — upload screenshots (multipart/form-data).
 * Accepts one or more files under `images`, `image` or `file`.
 * Owner/admin only; validation (MIME, size, safe names) happens in the
 * shared storage layer.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await requireApiUser();
    const { slug } = await params;
    const project = await requireEditableProject(slug, user);

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return apiError(
        415,
        "Unsupported Media Type",
        "Send screenshots as multipart/form-data.",
      );
    }

    const form = await request.formData();
    const files = ["images", "image", "file"].flatMap((key) =>
      form.getAll(key).filter((value): value is File => value instanceof File && value.size > 0),
    );

    const result = await addGalleryImagesFor(user, project, files);
    if (!result.ok) return serviceError(result);

    const images = await db
      .select({
        id: projectImages.id,
        path: projectImages.path,
        alt: projectImages.alt,
        position: projectImages.position,
      })
      .from(projectImages)
      .where(eq(projectImages.projectId, project.id));

    return Response.json({ info: result.info, images }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
