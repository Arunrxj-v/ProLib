import "server-only";

import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { UPLOAD_RULES } from "@/lib/constants";

/**
 * Local filesystem storage driver.
 *
 * Everything lands under `storage/uploads/**` and is served by the
 * `/uploads/[...path]` route handler, so the driver can be swapped for S3 or
 * Vercel Blob without touching call sites.
 */

export const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_PATH ??
  process.env.STORAGE_DIR ??
  path.join(process.cwd(), "storage"),
);

export const UPLOADS_ROOT = path.join(STORAGE_ROOT, "uploads");

export type UploadScope = "projects" | "galleries" | "avatars";

export type StoredFile = {
  /** Relative path used as the stored URL, e.g. /uploads/projects/ab/cd.png */
  path: string;
  absolutePath: string;
  bytes: number;
  contentType: string;
};

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** Validates type + size, then writes the file under a random name. */
export async function saveUpload(file: File, scope: UploadScope): Promise<StoredFile> {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
    throw new UploadError("No file was received.");
  }

  const extension = EXTENSION_BY_TYPE[file.type];
  if (!extension) {
    throw new UploadError(
      `Unsupported file type. Allowed: ${UPLOAD_RULES.allowedExtensions.join(", ")}.`,
    );
  }

  if (file.size > UPLOAD_RULES.maxBytes) {
    const mb = Math.round(UPLOAD_RULES.maxBytes / (1024 * 1024));
    throw new UploadError(`File is too large. Maximum size is ${mb} MB.`);
  }

  const bucket = randomBytes(2).toString("hex");
  const name = `${randomBytes(9).toString("hex")}.${extension}`;
  const relativeDir = path.join(scope, bucket);
  const absoluteDir = path.join(UPLOADS_ROOT, relativeDir);

  await fs.mkdir(absoluteDir, { recursive: true });
  const absolutePath = path.join(absoluteDir, name);
  await fs.writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    path: `/uploads/${relativeDir.split(path.sep).join("/")}/${name}`,
    absolutePath,
    bytes: file.size,
    contentType: file.type,
  };
}

/** Best-effort cleanup; never throws during a delete flow. */
export async function removeUpload(storedPath: string | null | undefined): Promise<void> {
  if (!storedPath || !storedPath.startsWith("/uploads/")) return;
  const absolutePath = resolveUploadPath(storedPath.replace(/^\/uploads\//, ""));
  if (!absolutePath) return;
  await fs.rm(absolutePath, { force: true }).catch(() => undefined);
}

/**
 * Maps a URL-relative upload path back to disk, refusing anything that would
 * escape the uploads directory (path traversal).
 */
export function resolveUploadPath(relative: string): string | null {
  const normalized = path.normalize(relative).replace(/^(\.\.[/\\])+/, "");
  const absolute = path.resolve(UPLOADS_ROOT, normalized);
  if (absolute !== UPLOADS_ROOT && !absolute.startsWith(UPLOADS_ROOT + path.sep)) {
    return null;
  }
  return absolute;
}
