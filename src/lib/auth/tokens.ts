import "server-only";

import { createHmac, randomBytes } from "node:crypto";

/**
 * Opaque session / verification tokens: random secret + keyed digest at rest.
 *
 * AUTH_SECRET peppers every digest, so a stolen database alone can no longer
 * be used to replay session cookies. Local development falls back to a fixed
 * placeholder so the zero-config flow keeps working; production refuses to
 * start without a real secret.
 */
const DEV_FALLBACK_SECRET = "prolib-local-dev-secret";

function secret(): string {
  const value = process.env.AUTH_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is required in production — set it in the environment (see .env.example).",
    );
  }
  return DEV_FALLBACK_SECRET;
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHmac("sha256", secret()).update(token).digest("hex");
}
