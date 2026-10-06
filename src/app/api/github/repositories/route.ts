import { githubReposJsonResponse } from "@/lib/githubApi";

export const dynamic = "force-dynamic";

/**
 * `GET /api/github/repositories` — documented alias of
 * `/api/github/repos` (§22): the signed-in student's real GitHub
 * repositories, straight from the GitHub API.
 */
export async function GET(request: Request) {
  return githubReposJsonResponse(request);
}
