import { NextResponse, type NextRequest } from "next/server";

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
  const url = new URL("/login", request.nextUrl);
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return url;
}

function isAuthScreen(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
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

  // Signed-in visitors skip the auth screens entirely (the page-level guard
  // still resolves the real user and picks /admin vs /dashboard by role).
  if (hasSession && isAuthScreen(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl), 302);
  }

  return NextResponse.next();
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
