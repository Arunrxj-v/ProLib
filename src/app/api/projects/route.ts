import { parseProjectQuery } from "@/lib/data/filters";
import { listProjects } from "@/lib/data/projects";
import {
  apiError,
  fileFromDataUri,
  handleApiError,
  pickString,
  pickStringArray,
  requireApiUser,
  validationResponse,
} from "@/lib/api";
import { fieldErrorsOf, projectFormSchema } from "@/lib/validation/projects";
import { createProjectFor } from "@/lib/projectService";

export const dynamic = "force-dynamic";

const MAX_PAGE_SIZE = 48;

/**
 * `GET /api/projects` — the same query surface as `/explore`, as JSON.
 *
 * Filters: `q`, `department`, `category`, `type`, `status`, `technology`,
 * `year`, `openSource`, `sort` — pagination: `page`, `limit` (alias
 * `pageSize`). Only publicly visible publication states are ever returned;
 * drafts and in-review work never leave this endpoint.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = parseProjectQuery(Object.fromEntries(searchParams.entries()));

  const requested = Number(
    searchParams.get("limit") ??
      searchParams.get("pageSize") ??
      query.pageSize,
  );
  query.pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 12),
  );

  try {
    const result = await listProjects(query);
    return Response.json(result);
  } catch (error) {
    console.error("project list failed", error);
    return apiError(500, "Internal Server Error", "Could not load projects.");
  }
}

/**
 * `POST /api/projects` — create a project (§15).
 *
 * `multipart/form-data` (cover file) or JSON with `cover_image` as a data
 * URI. Accepted keys, snake_case or camelCase:
 *   name, short_description, project_type, status, technologies[],
 *   github_repository, live_demo, description, department_id,
 *   academic_year_id, technology_ids[], publish
 *
 * Required: name, short_description, project_type, technologies,
 * cover_image. The row is created as a draft unless `publish: true`.
 * Ownership is enforced from the session — never from the body.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const contentType = request.headers.get("content-type") ?? "";

    let body: Record<string, unknown> = {};
    let cover: File | null = null;
    let technologyIds: string[] = [];
    let technologyNames: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const key of [
        "name",
        "title",
        "short_description",
        "shortDescription",
        "project_type",
        "projectType",
        "status",
        "description",
        "github_repository",
        "githubUrl",
        "live_demo",
        "demoUrl",
        "department_id",
        "academic_year_id",
        "publish",
        "intent",
      ]) {
        const value = form.get(key);
        if (typeof value === "string") body[key] = value;
      }
      technologyIds = form
        .getAll("technology_ids")
        .filter((value): value is string => typeof value === "string");
      const typed = form
        .getAll("technologies")
        .filter((value): value is string => typeof value === "string");
      if (typed.length === 0) {
        technologyNames = form
          .getAll("technologyNames")
          .filter((value): value is string => typeof value === "string");
      } else {
        technologyNames = typed;
      }
      const file = form.get("cover");
      if (file instanceof File && file.size > 0) cover = file;
    } else if (contentType.includes("application/json")) {
      const parsed = await request.json().catch(() => null);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return apiError(400, "Bad Request", "Expected a JSON object body.");
      }
      body = parsed as Record<string, unknown>;
      cover = fileFromDataUri(body.cover_image ?? body.coverImage);
      technologyIds =
        pickStringArray(body, ["technology_ids", "technologyIds"]) ?? [];
      technologyNames =
        pickStringArray(body, ["technologies", "technology_names"]) ?? [];
    } else {
      return apiError(
        415,
        "Unsupported Media Type",
        "Send multipart/form-data (with a cover file) or application/json.",
      );
    }

    const parsed = projectFormSchema.safeParse({
      title: pickString(body, ["name", "title"]) ?? "",
      shortDescription:
        pickString(body, ["short_description", "shortDescription"]) ?? "",
      projectType: pickString(body, ["project_type", "projectType"]) ?? "other",
      status: pickString(body, ["status"]) ?? "in_progress",
      departmentId: pickString(body, ["department_id", "departmentId"]) || null,
      categoryId: null,
      academicYearId:
        pickString(body, ["academic_year_id", "academicYearId"]) || null,
      semesterId: null,
      description: pickString(body, ["description"]) || null,
      sections: [],
      githubUrl:
        pickString(body, ["github_repository", "githubUrl", "github_url"]) || null,
      demoUrl: pickString(body, ["live_demo", "demoUrl", "demo_url"]) || null,
      docsUrl: null,
      videoUrl: null,
    });
    if (!parsed.success) {
      return validationResponse(fieldErrorsOf(parsed.error));
    }

    const publishFlag =
      body.publish === true ||
      body.publish === "true" ||
      body.publish === "1" ||
      body.intent === "publish";

    const result = await createProjectFor(user, {
      values: parsed.data,
      technologyIds,
      technologyNames,
      cover,
      intent: publishFlag ? "publish" : "draft",
    });
    if (!result.ok) {
      if (result.fieldErrors) return validationResponse(result.fieldErrors);
      return apiError(400, "Bad Request", result.error ?? "The project could not be created.");
    }

    return Response.json(
      { project: result.project, info: result.info },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
