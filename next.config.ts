import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production is served under the /prolib subpath
  // (https://server.tailda589d.ts.net/prolib), so every generated URL —
  // assets, links, router pushes — is prefixed with it. `next dev` keeps
  // serving from the root: the regression suites and the local GitHub OAuth
  // callback (http://localhost:3000/api/github/callback) are root-relative
  // and must not change. Next injects the resolved value into every bundle
  // as `process.env.__NEXT_ROUTER_BASEPATH` (src/lib/base-path.ts reads it),
  // so this config stays the single source of truth.
  basePath: process.env.NODE_ENV === "production" ? "/prolib" : "",
  // better-sqlite3 is a native module and must not be bundled by Next.
  serverExternalPackages: ["better-sqlite3"],
  images: {
    formats: ["image/avif", "image/webp"],
    // Seeded project covers are hand-drawn SVG schematics; uploads are raster.
    // The sandbox CSP keeps a served SVG from executing anything.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Uploaded project art is served by our own /uploads route handler.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
