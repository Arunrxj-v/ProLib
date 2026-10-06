import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { generateToken } from "@/lib/auth/tokens";
import {
  GITHUB_STATE_COOKIE,
  GITHUB_STATE_MAX_AGE,
  githubOAuthConfig,
  githubOAuthUrl,
  packGithubState,
} from "@/lib/github";

export const dynamic = "force-dynamic";

/**
 * Starts the GitHub OAuth flow for the signed-in student.
 *
 * Without GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET this endpoint answers
 * 501 `configured: false` instead of redirecting somewhere that cannot
 * work — the UI must never show a fake "Connected" state.
 *
 * The redirect URI comes from GITHUB_CALLBACK_URL when set — it must equal
 * the Authorization callback URL registered on the OAuth App exactly (single
 * path: /api/github/callback, no trailing slash). When unset it falls back to
 * the request origin + /api/github/callback, so any deployment host works
 * without a hardcoded localhost (local dev resolves to
 * http://localhost:3000/api/github/callback).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sign in required." },
      { status: 401 },
    );
  }

  if (!githubOAuthConfig()) {
    return NextResponse.json(
      {
        configured: false,
        error: "Not Implemented",
        message: "GitHub OAuth is not configured on this instance.",
      },
      { status: 501 },
    );
  }

  const state = generateToken();
  const redirectUri =
    process.env.GITHUB_CALLBACK_URL?.trim() ||
    `${request.nextUrl.origin}/api/github/callback`;
  const response = NextResponse.redirect(
    new URL(githubOAuthUrl(state, redirectUri)),
    302,
  );

  // Single-use, 10-minute, httpOnly cookie binding the round trip to this
  // browser and this user; the callback requires an exact match.
  response.cookies.set(
    GITHUB_STATE_COOKIE,
    packGithubState(user.id, state),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GITHUB_STATE_MAX_AGE,
    },
  );

  return response;
}
