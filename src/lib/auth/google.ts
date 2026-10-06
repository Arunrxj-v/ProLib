import "server-only";

/**
 * Google OAuth boundary.
 *
 * The flow is fully implemented (authorization-code exchange + userinfo), but
 * it only activates when real credentials are present in the environment:
 *
 *   GOOGLE_CLIENT_ID=...
 *   GOOGLE_CLIENT_SECRET=...
 *
 * Without them the sign-in screen simply hides the button — nothing is faked.
 */

import { absoluteUrl } from "@/lib/utils";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

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
  return getConfig() !== null;
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

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string,
): Promise<GoogleProfile | null> {
  const config = getConfig();
  if (!config) return null;

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
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

    const profileResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
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
