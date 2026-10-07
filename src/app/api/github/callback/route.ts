import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { hashToken } from "@/lib/auth/tokens";
import { withBase } from "@/lib/base-path";
import {
  GITHUB_STATE_COOKIE,
  GithubError,
  exchangeGithubCode,
  fetchGithubUser,
  githubOAuthConfig,
  unpackGithubState,
  upsertGithubAccount,
} from "@/lib/github";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

function sameValue(a: string | undefined, b: string | undefined) {
  if (!a || !b) return false;
  return hashToken(a) === hashToken(b);
}

function isUniqueViolation(error: unknown): boolean {
  // drizzle-orm wraps driver errors in DrizzleQueryError; the SQLSTATE lives
  // on the original driver error in `.cause`.
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === "object" && "code" in current) {
      // PostgreSQL SQLSTATE for a unique-constraint violation.
      if ((current as { code?: unknown }).code === "23505") return true;
    }
    if (current instanceof Error && /duplicate key value violates unique constraint|UNIQUE constraint failed/i.test(current.message)) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Honest interstitial when the callback arrives without a ProLib session:
 * there is no user to attach the GitHub account to, and no user row is ever
 * created from GitHub data.
 */
function signInFirst(): NextResponse {
  const response = new NextResponse(
    [
      "<!doctype html>",
      '<html lang="en"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>Sign in first — ProLib</title>",
      "<style>",
      "body{margin:0;min-height:100vh;display:grid;place-items:center;",
      "background:#0d1117;color:#e6edf3;font-family:ui-sans-serif,system-ui,sans-serif}",
      "main{max-width:32rem;padding:2rem;text-align:left}",
      "h1{font-size:1.5rem;margin:0 0 .75rem}",
      "p{color:#9198a1;line-height:1.6;margin:0 0 1.5rem}",
      "a{display:inline-block;background:#238636;color:#fff;text-decoration:none;",
      "padding:.6rem 1.1rem;border-radius:6px;font-weight:600}",
      "a:hover{background:#2ea043}",
      "</style></head><body><main>",
      "<h1>Sign in to ProLib first</h1>",
      "<p>GitHub sent you back here, but this browser has no active ProLib",
      "session, so there is no account to connect GitHub to. ProLib never",
      "creates an account from GitHub data — sign in and connect again.</p>",
      '<a href="' +
        withBase("/login?next=%2Fdashboard%2Fprofile") +
        '">Sign in to ProLib</a>',
      "</main></body></html>",
    ].join("\n"),
    { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
  response.cookies.delete(GITHUB_STATE_COOKIE);
  return response;
}

/**
 * GitHub OAuth callback: state check (cookie nonce + bound user id) → code
 * exchange → real GitHub identity → upsert into `github_accounts`.
 *
 * The row is always attached to the EXISTING signed-in user; GitHub data
 * never creates or modifies a `users` row. Every failure redirects back to
 * the profile page with an explicit `reason` so the UI can tell the truth.
 */
export async function GET(request: NextRequest) {
  const fail = (reason: string) => {
    const response = NextResponse.redirect(
      absoluteUrl(`/dashboard/profile?github=error&reason=${encodeURIComponent(reason)}`),
      302,
    );
    response.cookies.delete(GITHUB_STATE_COOKIE);
    return response;
  };

  const succeed = () => {
    const response = NextResponse.redirect(
      absoluteUrl("/dashboard/profile?github=connected"),
      302,
    );
    response.cookies.delete(GITHUB_STATE_COOKIE);
    return response;
  };

  // The user declined on GitHub's consent screen.
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return fail(providerError === "access_denied" ? "denied" : "state");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = unpackGithubState(
    request.cookies.get(GITHUB_STATE_COOKIE)?.value,
  );

  if (!code || !state || !cookieState || !sameValue(state, cookieState.state)) {
    return fail("state");
  }

  const user = await getCurrentUser();
  if (!user) return signInFirst();

  // The cookie was issued to a different account than the one now signed in.
  if (user.id !== cookieState.userId) return fail("state");

  if (!githubOAuthConfig()) return fail("not_configured");

  const redirectUri =
    process.env.GITHUB_CALLBACK_URL?.trim() ||
    absoluteUrl("/api/github/callback");

  let accessToken: string;
  try {
    accessToken = await exchangeGithubCode(code, redirectUri);
  } catch (error) {
    if (!(error instanceof GithubError)) {
      console.error("[github/callback] code exchange failed:", error);
    }
    return fail(error instanceof GithubError ? error.reason : "unreachable");
  }

  try {
    const profile = await fetchGithubUser(accessToken);
    await upsertGithubAccount(user.id, profile, accessToken);
  } catch (error) {
    if (error instanceof GithubError) {
      return fail(error.reason);
    }
    if (isUniqueViolation(error)) {
      // Another ProLib user already linked this GitHub account.
      return fail("account_taken");
    }
    console.error("[github/callback] account link failed:", error);
    return fail("unreachable");
  }

  return succeed();
}
