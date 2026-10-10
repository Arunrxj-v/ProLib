import type { NextConfig } from "next";

import { REMOTE_IMAGE_HOSTS } from "./src/lib/imageHosts";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module and must not be bundled by Next.
  serverExternalPackages: ["better-sqlite3"],
  images: {
    formats: ["image/avif", "image/webp"],
    // Google OAuth profile pictures: the callback stores userinfo's `picture`
    // (lh3.googleusercontent.com/…) in users.avatarUrl, and Avatar renders it
    // through next/image. HTTPS only, exact hostnames from the shared list —
    // every other remote host stays blocked; uploads and seeded covers are
    // same-origin paths.
    remotePatterns: REMOTE_IMAGE_HOSTS.map((hostname) => ({
      protocol: "https",
      hostname,
      // Google avatar paths vary (/a/…, /a-/…s96-c); any path on this
      // exact host is a Google-hosted image.
      pathname: "/**",
      port: "",
    })),
    // Seeded project covers are hand-drawn SVG schematics; uploads are raster.
    // The sandbox CSP keeps a served SVG from executing anything.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Uploaded project art is served by our own /uploads route handler.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
