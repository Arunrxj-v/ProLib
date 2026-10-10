import "server-only";

/**
 * Google OAuth boundary.
 *
 * The flow is fully implemented (authorization-code exchange + userinfo), but
 * it only activates when real credentials *and* an explicit college email
 * domain allowlist are present in the environment:
 *
 *   GOOGLE_CLIENT_ID=...
 *   GOOGLE_CLIENT_SECRET=...
 *   ALLOWED_COLLEGE_EMAIL_DOMAINS=ceconline.edu
 *
 * Without them the sign-in screens still show the button — visibly disabled,
 * with a note naming the exact variables — instead of faking a provider.
 *
 * The allowlist is enforced server-side in the callback against the email
 * Google reports as verified; a personal address (gmail.com, outlook.com, …)
 * never creates a user or a session unless its domain is explicitly listed.
 */

import { absoluteUrl } from "@/lib/utils";

const PRODUCTION_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const PRODUCTION_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const PRODUCTION_USERINFO_ENDPOINT =
  "https://openidconnect.googleapis.com/v1/userinfo";

/**
 * Test-only endpoint overrides (§31, same pattern as GITHUB_WEB_ORIGIN /
 * GITHUB_API_ORIGIN): pointing ProLib at a local provider double exercises
 * the *real* code-exchange + userinfo code paths without contacting Google.
 *
 * Both overrides are ignored in production, so a deployed instance always
 * talks to the shipped Google endpoints regardless of the environment.
 */
function tokenEndpoint(): string {
  const override = process.env.GOOGLE_TOKEN_ENDPOINT?.trim();
  if (process.env.NODE_ENV !== "production" && override) return override;
  return PRODUCTION_TOKEN_ENDPOINT;
}

function userinfoEndpoint(): string {
  const override = process.env.GOOGLE_USERINFO_ENDPOINT?.trim();
  if (process.env.NODE_ENV !== "production" && override) return override;
  return PRODUCTION_USERINFO_ENDPOINT;
}

const authEndpoint = (): string =>
  process.env.NODE_ENV !== "production" &&
  process.env.GOOGLE_AUTH_ENDPOINT?.trim()
    ? process.env.GOOGLE_AUTH_ENDPOINT.trim()
    : PRODUCTION_AUTH_ENDPOINT;

/**
 * College email domains Google sign-in accepts, read from
 * `ALLOWED_COLLEGE_EMAIL_DOMAINS` (comma/whitespace separated). Entries are
 * normalised ("@Ceconline.edu, " → "ceconline.edu") so configuration cannot
 * silently miss by casing or an accidental leading `@`.
 */
export function getAllowedCollegeDomains(): string[] {
  return (process.env.ALLOWED_COLLEGE_EMAIL_DOMAINS ?? "")
    .split(/[,\s]+/)
    .map((entry) => entry.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
}

/**
 * Server-side college-domain gate for Google sign-in. Fail-closed: with no
 * domains configured nothing is allowed, and a malformed address never
 * matches. The email always comes from Google's verified userinfo response —
 * never from a query parameter or anything the browser controls.
 */
export function isAllowedCollegeEmail(email: string): boolean {
  const domains = getAllowedCollegeDomains();
  if (domains.length === 0) return false;

  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return false;

  return domains.includes(normalized.slice(at + 1));
}

export type GoogleProfile = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
  hostedDomain?: string;
};

type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string };

function getConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri:
      process.env.GOOGLE_CALLBACK_URL?.trim() ||
      absoluteUrl("/api/auth/callback/google"),
  };
}

export function isGoogleAuthEnabled(): boolean {
  // Blank = feature off (the project-wide env convention): provider
  // credentials alone are not enough — the college allowlist must be
  // configured too, otherwise every Google address would be non-college.
  return getConfig() !== null && getAllowedCollegeDomains().length > 0;
}

export function buildGoogleAuthUrl(state: string): string {
  const config = getConfig();
  if (!config) throw new Error("Google sign-in is not configured");

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });

  return `${authEndpoint()}?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string,
): Promise<GoogleProfile | null> {
  const config = getConfig();
  if (!config) return null;

  try {
    const tokenResponse = await fetch(tokenEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) return null;

    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) return null;

    const profileResponse = await fetch(userinfoEndpoint(), {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    });

    if (!profileResponse.ok) return null;

    const profile = (await profileResponse.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
      hd?: string;
    };

    if (!profile.email) return null;

    return {
      id: profile.sub ?? "",
      email: profile.email.toLowerCase(),
      emailVerified: Boolean(profile.email_verified),
      name: profile.name?.trim() || profile.email.split("@")[0],
      picture: profile.picture,
      hostedDomain: profile.hd,
    };
  } catch {
    return null;
  }
}
