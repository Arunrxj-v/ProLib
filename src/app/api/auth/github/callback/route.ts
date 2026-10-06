/**
 * Compatibility alias for the GitHub OAuth callback.
 *
 * The canonical route is `/api/github/callback`. This path exists because the
 * local GitHub OAuth App has `http://localhost:3000/api/auth/github/callback`
 * registered as its Authorization callback URL — GitHub redirects the browser
 * to whatever is registered there, and `GITHUB_CALLBACK_URL` points both the
 * authorize request and the token exchange at the same value, so the flow is
 * identical whichever of the two paths is configured.
 *
 * All behavior (state CSRF check, code exchange, account association) lives in
 * the canonical handler re-exported below — there is exactly one implementation.
 */
// Route config must be declared locally (Next.js rejects re-exported config).
export const dynamic = "force-dynamic";
export { GET } from "@/app/api/github/callback/route";
