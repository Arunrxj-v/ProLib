import { type NextRequest } from "next/server";
import { z } from "zod";

import { fetchPublicRepoMeta } from "@/lib/github";

export const dynamic = "force-dynamic";

const ownerSchema = z
  .string()
  .trim()
  .min(1, "Missing repository owner.")
  .max(39)
  .regex(
    /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/,
    "That is not a GitHub owner name.",
  );

const nameSchema = z
  .string()
  .trim()
  .min(1, "Missing repository name.")
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/, "That is not a GitHub repository name.");

const paramsSchema = z.object({ owner: ownerSchema, name: nameSchema });

/**
 * Public, unauthenticated repository metadata (stars, forks, topics,
 * languages) for project pages — real GitHub data or an explicit
 * `available: false` with the honest reason. Nothing is ever invented.
 */
export async function GET(request: NextRequest) {
  const parsed = paramsSchema.safeParse({
    owner: request.nextUrl.searchParams.get("owner") ?? "",
    name: request.nextUrl.searchParams.get("name") ?? "",
  });

  if (!parsed.success) {
    return Response.json(
      {
        available: false,
        reason: "not_found",
        error: "Bad Request",
        message:
          "Provide a repository owner and name, e.g. ?owner=vercel&name=next.js",
      },
      { status: 400 },
    );
  }

  return Response.json(
    await fetchPublicRepoMeta(parsed.data.owner, parsed.data.name),
  );
}
