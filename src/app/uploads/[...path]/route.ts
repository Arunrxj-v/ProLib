import fs from "node:fs/promises";

import { resolveUploadPath } from "@/lib/storage";

/**
 * Serves files written by the local storage driver.
 *
 * The path is re-resolved against `storage/uploads` on every request, so a
 * `..` segment can never escape the directory.
 */

const CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relative = segments.join("/");

  const absolute = resolveUploadPath(relative);
  if (!absolute) {
    return new Response("Not found", { status: 404 });
  }

  const extension = absolute.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPE[extension];
  if (!contentType) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(absolute);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(data.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
