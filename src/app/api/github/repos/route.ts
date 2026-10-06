import { githubReposJsonResponse } from "@/lib/githubApi";

export const dynamic = "force-dynamic";

/** `GET /api/github/repos` — see `githubReposJsonResponse` for the contract. */
export async function GET(request: Request) {
  return githubReposJsonResponse(request);
}
