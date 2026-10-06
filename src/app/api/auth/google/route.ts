import { NextResponse, type NextRequest } from "next/server";

import { buildGoogleAuthUrl, isGoogleAuthEnabled } from "@/lib/auth/google";
import { generateToken } from "@/lib/auth/tokens";
import { safeNextPath } from "@/lib/auth/validation";

export const dynamic = "force-dynamic";

const STATE_MAX_AGE = 600; // seconds

/**
 * Starts the Google authorization-code flow.
 *
 * The OAuth state is a single-use, httpOnly cookie so the callback can prove
 * the round trip came from this browser. Without GOOGLE_CLIENT_ID /
 * GOOGLE_CLIENT_SECRET in the environment this endpoint refuses to run — the
 * UI hides the button instead of faking a provider.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(
    request.nextUrl.searchParams.get("next"),
    "/dashboard",
  );

  if (!isGoogleAuthEnabled()) {
    return NextResponse.redirect(
      new URL("/login?error=google_disabled", request.url),
    );
  }

  const state = generateToken();
  const response = NextResponse.redirect(new URL(buildGoogleAuthUrl(state)));
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MAX_AGE,
  };

  response.cookies.set("prolib_oauth_state", state, options);
  response.cookies.set("prolib_oauth_next", next, options);
  return response;
}
