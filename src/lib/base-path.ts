/**
 * The deployment subpath this build is mounted under.
 *
 * Next defines `__NEXT_ROUTER_BASEPATH` from `next.config.ts`'s `basePath`
 * in every bundled context — client components, server components, route
 * handlers and the proxy — so this value always matches the config without
 * repeating the literal: "" in development, "/prolib" in production.
 *
 * `next/link` / `next/router` apply it automatically; everything that emits
 * or requests a root-absolute path by hand (raw fetch() calls, hand-built
 * redirect Locations, `next/image` sources) must go through {@link withBase}.
 */
export const BASE_PATH: string = process.env.__NEXT_ROUTER_BASEPATH ?? "";

/**
 * Prefix an app-absolute path ("/api/x", "/dashboard") with the deployment
 * base path so it resolves correctly behind the /prolib mount.
 *
 * Absolute URLs, protocol-relative URLs, paths already carrying the base
 * path and non-path values are returned unchanged — so the call is safe in
 * development (where BASE_PATH is "") and idempotent everywhere else.
 */
export function withBase(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (!BASE_PATH) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return path === "/" ? BASE_PATH : `${BASE_PATH}${path}`;
}
