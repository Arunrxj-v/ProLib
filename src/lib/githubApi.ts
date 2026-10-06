import "server-only";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { GithubError, getGithubAccount, listGithubRepos } from "@/lib/github";

/** Free-text narrowing for the repository picker — bounded, never interpolated. */
const searchSchema = z
  .string()
  .trim()
  .max(60, "Keep the search to 60 characters.");

/**
 * `GET` response for the signed-in student's real repositories — shared by
 * `/api/github/repos` and its documented alias `/api/github/repositories`.
 *
 * `connected: false` (401) means no GitHub account row exists — the UI must
 * offer "Connect GitHub", never an empty fake list. A revoked token comes
 * back as `stale: true` with an empty list, also honestly.
 */
export async function githubReposJsonResponse(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { connected: false, error: "Unauthorized", message: "Sign in required." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const query = searchSchema.safeParse(url.searchParams.get("q") ?? "");
  if (!query.success) {
    return Response.json(
      {
        error: "Bad Request",
        message: "Keep the search to 60 characters.",
      },
      { status: 400 },
    );
  }

  const account = await getGithubAccount(user.id);
  if (!account) {
    return Response.json(
      {
        connected: false,
        error: "Unauthorized",
        message: "GitHub is not connected yet.",
      },
      { status: 401 },
    );
  }

  try {
    const items = await listGithubRepos(
      account.accessToken,
      query.data,
      account.login,
    );
    return Response.json({ connected: true, login: account.login, items });
  } catch (error) {
    if (error instanceof GithubError) {
      // Rate limiting is not a dead token — say exactly that.
      if (error.reason === "rate_limited") {
        return Response.json({
          connected: true,
          login: account.login,
          rateLimited: true,
          items: [],
        });
      }
      // 401/403 on an authenticated call ⇒ the stored token no longer works.
      if (error.status === 401 || error.status === 403) {
        return Response.json({
          connected: true,
          login: account.login,
          stale: true,
          items: [],
        });
      }
    }
    return Response.json(
      {
        connected: true,
        login: account.login,
        error: "Bad Gateway",
        message: "GitHub is unavailable right now.",
      },
      { status: 502 },
    );
  }
}
