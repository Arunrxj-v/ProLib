import { getCurrentUser } from "@/lib/auth/session";
import { getGithubIdentity, githubOAuthConfig } from "@/lib/github";

export const dynamic = "force-dynamic";

/**
 * `GET /api/github/status` — honest connection state for the UI.
 *
 * `configured` reflects whether GITHUB_CLIENT_ID/SECRET are actually set, so
 * the interface can say "not configured on this instance" instead of faking a
 * connect button that could never work. `identity` only ever contains display
 * columns — never the OAuth token.
 */
export async function GET() {
  const configured = githubOAuthConfig() !== null;
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ configured, signedIn: false, connected: false });
  }

  const identity = await getGithubIdentity(user.id);
  return Response.json({
    configured,
    signedIn: true,
    connected: Boolean(identity),
    identity,
  });
}
