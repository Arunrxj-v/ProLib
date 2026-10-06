import { revalidatePath } from "next/cache";

import {
  apiError,
  fileFromDataUri,
  handleApiError,
  pickString,
  pickStringArray,
  requireApiUser,
  requireEditableProject,
  serviceError,
  validationResponse,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getProjectByIdOrSlug,
  getPublicStatuses,
} from "@/lib/data/projects";
import {
  deleteProjectFor,
  publishProjectFor,
  updateProjectFor,
  withdrawProjectFor,
} from "@/lib/projectService";
import { fieldErrorsOf, projectFormSchema } from "@/lib/validation/projects";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * `GET /api/projects/:id` — full project record as JSON; `:id` is the
 * public slug or the internal UUID. Drafts and in-review work only
 * resolve for the owner or an admin; everyone else gets 404 (existence
 * is never leaked).
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { slug } = await params;

    const detail = await getProjectByIdOrSlug(slug);
    if (!detail) {
      return apiError(404, "Not Found", "Project not found.");
    }

    const user = await getCurrentUser();
    const statuses = await getPublicStatuses();
    const isOwner = user?.id === detail.project.ownerId;
    const canView =
      statuses.includes(detail.project.publicationStatus) ||
      user?.role === "admin" ||
      Boolean(isOwner);

    if (!canView) {
      return apiError(404, "Not Found", "Project not found.");
    }

    const privileged = Boolean(isOwner) || user?.role === "admin";

    return Response.json({
      ...detail,
      project: {
        ...detail.project,
        // Internal moderation fields stay with the people who need them.
        ownerId: undefined,
        reviewedById: undefined,
        reviewNote: privileged ? detail.project.reviewNote : undefined,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * `PATCH /api/projects/:id` — partial update (§13/§14).
 *
 * Authorization: owner or admin only (403 for other signed-in students,
 * 404 for invisible drafts). Accepted keys (snake_case or camelCase):
 * name, short_description, project_type, status, description, links,
 * department_id, category_id, academic_year_id, semester_id,
 * technologies[] / technology_ids[], sections[], cover_image (data URI)
 * or a multipart `cover` file, remove_cover, publish.
 *
 * `publish: true|false` drives the same moderation-aware publish/withdraw
 * rules the dashboard uses (§16). Content changes are validated with the
 * same schema as the forms.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireApiUser();
    const { slug } = await params;
    const project = await requireEditableProject(slug, user);

    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, unknown> = {};
    let cover: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const key of Array.from(form.keys())) {
        const value = form.get(key);
        if (typeof value === "string") body[key] = value;
      }
      const file = form.get("cover");
      if (file instanceof File && file.size > 0) cover = file;
      const sectionsValue = form.get("sections");
      if (typeof sectionsValue === "string" && sectionsValue.trim()) {
        try {
          body.sections = JSON.parse(sectionsValue);
        } catch {
          return apiError(400, "Bad Request", "sections must be a JSON array.");
        }
      }
    } else {
      const parsed = await request.json().catch(() => null);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return apiError(400, "Bad Request", "Expected a JSON object body.");
      }
      body = parsed as Record<string, unknown>;
      cover = fileFromDataUri(body.cover_image ?? body.coverImage);
    }

    const present = (key: string) => body[key] !== undefined;

    const parsedValues = projectFormSchema.safeParse({
      title: pickString(body, ["name", "title"]) ?? project.title,
      shortDescription:
        pickString(body, ["short_description", "shortDescription"]) ??
        project.shortDescription,
      projectType:
        pickString(body, ["project_type", "projectType"]) ?? project.projectType,
      status: pickString(body, ["status"]) ?? project.status,
      departmentId: present("department_id") || present("departmentId")
        ? pickString(body, ["department_id", "departmentId"]) || null
        : project.departmentId,
      categoryId: present("category_id") || present("categoryId")
        ? pickString(body, ["category_id", "categoryId"]) || null
        : project.categoryId,
      academicYearId: present("academic_year_id") || present("academicYearId")
        ? pickString(body, ["academic_year_id", "academicYearId"]) || null
        : project.academicYearId,
      semesterId: present("semester_id") || present("semesterId")
        ? pickString(body, ["semester_id", "semesterId"]) || null
        : project.semesterId,
      description: present("description")
        ? pickString(body, ["description"]) || null
        : project.description,
      sections: body.sections,
      githubUrl:
        pickString(body, ["github_repository", "githubUrl", "github_url"]) ??
        project.githubUrl,
      demoUrl:
        pickString(body, ["live_demo", "demoUrl", "demo_url"]) ?? project.demoUrl,
      docsUrl: pickString(body, ["docs_url", "docsUrl"]) ?? project.docsUrl,
      videoUrl: pickString(body, ["video_url", "videoUrl"]) ?? project.videoUrl,
    });
    if (!parsedValues.success) {
      return validationResponse(fieldErrorsOf(parsedValues.error));
    }

    const technologyIds = pickStringArray(body, ["technology_ids", "technologyIds"]);
    const technologyNames = pickStringArray(body, ["technologies", "technology_names"]);
    const removeCover =
      body.remove_cover === true || body.remove_cover === "true";
    const galleryFile = body.gallery_image ? fileFromDataUri(body.gallery_image) : null;

    const result = await updateProjectFor(user, project, {
      values: parsedValues.data,
      ...(technologyIds || technologyNames
        ? { technologyIds: technologyIds ?? [], technologyNames: technologyNames ?? [] }
        : {}),
      ...(body.sections !== undefined && parsedValues.data.sections
        ? { sections: parsedValues.data.sections }
        : {}),
      cover,
      removeCover,
      ...(galleryFile ? { galleryFiles: [galleryFile] } : {}),
    });
    if (!result.ok) {
      if (result.fieldErrors) return validationResponse(result.fieldErrors);
      return apiError(400, "Bad Request", result.error ?? "The project could not be saved.");
    }

    // §16 publishing — same moderation-aware rules as the dashboard.
    const status = pickString(body, ["publication_status", "publicationStatus"]);
    const wantsPublish =
      body.publish === true ||
      body.publish === "true" ||
      status === "published" ||
      status === "submitted";
    const wantsDraft =
      body.publish === false ||
      body.publish === "false" ||
      status === "draft";

    let finalDetail = await getProjectByIdOrSlug(project.id);
    let publish:
      | { ok: boolean; status: string; message: string }
      | undefined;

    if (wantsPublish && finalDetail) {
      const outcome = await publishProjectFor(user, finalDetail.project);
      publish = {
        ok: outcome.ok,
        status: outcome.ok ? "requested" : finalDetail.project.publicationStatus,
        message: outcome.ok
          ? (outcome.info ?? "Published.")
          : (outcome.error ?? "Could not publish."),
      };
      finalDetail = (await getProjectByIdOrSlug(project.id)) ?? finalDetail;
    } else if (wantsDraft && finalDetail) {
      const outcome = await withdrawProjectFor(user, finalDetail.project);
      publish = {
        ok: outcome.ok,
        status: "draft",
        message: outcome.ok
          ? (outcome.info ?? "Back to drafts.")
          : (outcome.error ?? "Could not withdraw."),
      };
      finalDetail = (await getProjectByIdOrSlug(project.id)) ?? finalDetail;
    }

    revalidatePath("/dashboard/projects");
    if (finalDetail) revalidatePath(`/projects/${finalDetail.project.slug}`);

    return Response.json({
      project: finalDetail?.project ?? result.project,
      info: result.info,
      ...(publish ? { publish } : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * `DELETE /api/projects/:id` — owner or admin only (§14).
 * Cover image and gallery files are removed from disk with the row.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireApiUser();
    const { slug } = await params;
    const project = await requireEditableProject(slug, user);

    const result = await deleteProjectFor(user, project);
    if (!result.ok) return serviceError(result);

    revalidatePath("/dashboard/projects");
    return Response.json({ deleted: true, id: project.id, info: result.info });
  } catch (error) {
    return handleApiError(error);
  }
}
