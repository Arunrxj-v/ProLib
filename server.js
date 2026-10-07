/**
 * ProLib production server.
 *
 * The public site is mounted at https://server.tailda589d.ts.net/prolib.
 * The Tailscale serve proxy in front of this process strips the /prolib
 * mount prefix before forwarding (`http.StripPrefix(mountPoint, …)` in
 * tailscale/ipn/ipnlocal/serve.go), while Next.js with `basePath:
 * "/prolib"` only serves requests that still carry the prefix. Requests
 * arriving here WITHOUT the prefix therefore get it re-added below before
 * Next sees them; requests that already carry it (a path-preserving proxy,
 * or a direct hit on the mount) pass through untouched. The prefix comes
 * from the build manifest, so it can never drift from next.config.ts.
 *
 * Development keeps using `next dev` directly (basePath is "" there, so no
 * prefixing is needed and the local regression suites are unaffected).
 *
 * Not processed by the Next compiler (see custom-server docs): keep the
 * syntax to what the deployed Node.js version supports without a build step.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS entry point, run directly by Node */
const { createServer } = require("http");
const { readFileSync } = require("fs");
const path = require("path");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

// Base path of THIS build, as recorded by `next build` ("" in a root build).
function buildBasePath() {
  try {
    const manifest = JSON.parse(
      readFileSync(
        path.join(__dirname, ".next", "required-server-files.json"),
        "utf8",
      ),
    );
    return (manifest.config && manifest.config.basePath) || "";
  } catch (error) {
    throw new Error(
      ".next/required-server-files.json is missing — run `npm run build` before `npm start`. (" +
        String(error) +
        ")",
    );
  }
}

/**
 * Re-add the mount prefix the proxy stripped, leaving already-prefixed
 * paths (and everything outside the mount) exactly as they are.
 */
function applyBasePath(url, basePath) {
  const queryIndex = url.indexOf("?");
  const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
  const search = queryIndex === -1 ? "" : url.slice(queryIndex);
  if (pathname === basePath || pathname.startsWith(`${basePath}/`)) {
    return url;
  }
  const prefixed = pathname === "/" ? basePath : `${basePath}${pathname}`;
  return `${prefixed}${search}`;
}

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const basePath = dev ? "" : buildBasePath();
  createServer((req, res) => {
    if (basePath) {
      req.url = applyBasePath(req.url || "/", basePath);
    }
    handle(req, res);
  }).listen(port, () => {
    console.log(
      `> ProLib listening on http://localhost:${port}${
        basePath || "/"} (${dev ? "development" : "production"})`,
    );
  });
});
