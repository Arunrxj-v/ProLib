import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
