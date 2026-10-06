import "server-only";

import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import {
  getProjectByIdOrSlug,
  getPublicStatuses,
} from "@/lib/data/projects";
import type { Project } from "@/lib/db/schema";

/**
 * REST error contract (§26).
 *
 * Every `/api/*` response — success or failure — is JSON with a stable
 * shape: `{ error, message }` plus `fieldErrors` when validation failed.
 * Status codes: 400 / 401 / 403 / 404 / 409 / 422 / 500. HTML error pages
 * never leak out of an API route.
 */
export type ApiErrorBody = {
  error: string;
  message: string;
  fieldErrors?: Record<string, string>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function apiError(
  status: number,
  code: string,
  message: string,
  extra?: { fieldErrors?: Record<string, string> },
): Response {
  const body: ApiErrorBody = { error: code, message };
  if (extra?.fieldErrors) body.fieldErrors = extra.fieldErrors;
  return Response.json(body, { status });
}

/** Last-resort handler: log the real cause, answer with a clean JSON 500. */
export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return apiError(error.status, error.code, error.message, {
      fieldErrors: error.fieldErrors,
    });
  }
  console.error("api: unhandled error", error);
  return apiError(500, "Internal Server Error", "Something went wrong on the server.");
}

/** Validation failures from the shared zod schemas → 422 + fieldErrors. */
export function validationResponse(
  fieldErrors: Record<string, string>,
  message = "Some fields need attention.",
): Response {
  return apiError(422, "Unprocessable Entity", message, { fieldErrors });
}

/** Maps a `ServiceResult` failure into its HTTP response. */
export function serviceError(
  result: { error?: string; info?: string; fieldErrors?: Record<string, string>; conflict?: boolean },
  fallbackMessage = "The request could not be completed.",
): Response {
  if (result.fieldErrors) return validationResponse(result.fieldErrors);
  const message = result.error ?? fallbackMessage;
  if (result.conflict) return apiError(409, "Conflict", message);
  return apiError(400, "Bad Request", message);
}

/* ------------------------------------------------------------------ */
/* Auth guards for route handlers                                      */
/* ------------------------------------------------------------------ */

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Unauthorized", "Authentication required");
  return user;
}

export async function optionalApiUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}

/**
 * Resolves a project for mutation endpoints with §14-correct statuses:
 *   - not found, or a private draft the caller may not see → 404
 *     (existence is never leaked)
 *   - visible but owned by someone else → 403
 *   - otherwise the project, ready for the shared ownership re-check
 */
export async function requireEditableProject(
  idOrSlug: string,
  user: SessionUser,
): Promise<Project> {
  const detail = await getProjectByIdOrSlug(idOrSlug);
  if (!detail) {
    throw new ApiError(404, "Not Found", "Project not found.");
  }

  const project = detail.project;
  const statuses = await getPublicStatuses();
  const isOwner = project.ownerId === user.id;
  const isAdmin = user.role === "admin";
  const canView =
    statuses.includes(project.publicationStatus) || isOwner || isAdmin;

  if (!canView) {
    throw new ApiError(404, "Not Found", "Project not found.");
  }
  if (!isOwner && !isAdmin) {
    throw new ApiError(
      403,
      "Forbidden",
      "Only the project owner or an administrator can change this project.",
    );
  }

  return project;
}

/* ------------------------------------------------------------------ */
/* Body helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Accepts `data:image/…;base64,…` so JSON clients can create projects
 * with a cover without multipart. Validation (MIME/size) still happens in
 * `saveUpload` — this only converts bytes into a File.
 */
export function fileFromDataUri(value: unknown): File | null {
  if (typeof value !== "string") return null;
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/
    .exec(value.trim());
  if (!match) return null;

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) return null;

  const extension: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };
  const type = match[1].toLowerCase();
  return new File([bytes], `upload.${extension[type] ?? "bin"}`, { type });
}

/** First non-empty string among candidate keys (snake_case or camelCase). */
export function pickString(
  body: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

/** First non-empty array of strings among candidate keys. */
export function pickStringArray(
  body: Record<string, unknown>,
  keys: string[],
): string[] | undefined {
  for (const key of keys) {
    const value = body[key];
    if (Array.isArray(value)) {
      const items = value.filter(
        (item): item is string => typeof item === "string",
      );
      return items;
    }
  }
  return undefined;
}
