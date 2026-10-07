import { NextResponse, type NextRequest } from "next/server";

import { withBase } from "@/lib/base-path";

/**
 * Cookie-presence guard for the two signed-in areas of the site.
 *
 * This file deliberately never touches the database: it runs in the proxy
 * layer, outside the Node.js request workers where `server-only` modules
 * live. It only checks whether a session cookie is *present*, so a forged
 * cookie still lands on a page whose `requireUser()` / `requireAdmin()`
 * performs the real, database-backed check.
 */

const SESSION_COOKIE = "prolib_session";

/** Same-origin path only — a crafted `?next=` must never bounce off-site. */
function loginUrl(request: NextRequest): URL {
  // withBase keeps the Location under the production /prolib mount; in
  // development (basePath "") it is a no-op.
  const url = new URL(withBase("/login"), request.nextUrl);
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return url;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  const needsSession =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  // Signed-out visitor in a private area → sign in, then come back here.
  if (needsSession && !hasSession) {
    return NextResponse.redirect(loginUrl(request), 302);
  }

  // Cookie *presence* is only ever used as a fast-path INTO /login — never
  // to bounce away from an auth screen. Validity lives in the session table
  // (requireUser/getCurrentUser), and /login + /signup run that database
  // check themselves before redirecting a genuinely signed-in visitor.
  // Treating presence as authentication here made a stale cookie (row wiped
  // by a DB reset) bounce /login → /dashboard → /login forever — a redirect
  // loop the browser could never settle (§15: middleware and the auth
  // library must not disagree about what a session is).
  //
  // Forward the real path+query so page-level guards (layouts) can preserve
  // the full destination in ?next= — the proxy sees the true URL, a layout
  // only sees itself.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-prolib-path", `${pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/login",
    "/signup",
  ],
};
