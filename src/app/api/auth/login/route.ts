import { isGoogleAuthEnabled } from "@/lib/auth/google";

export const dynamic = "force-dynamic";

/**
 * `GET /api/auth/login` — advertises the sign-in mechanisms this instance
 * actually has. Providers are reported honestly (`enabled` reflects the
 * environment); nothing is ever faked. Browsers use `/login` (email +
 * password, with the Google button) — the API exposes this so clients can
 * discover the flow without hardcoding it.
 */
export async function GET() {
  return Response.json({
    providers: [
      {
        id: "google",
        label: "Google",
        enabled: isGoogleAuthEnabled(),
        authorizeUrl: "/api/auth/google",
      },
      {
        id: "password",
        label: "Email and password",
        enabled: true,
        loginPage: "/login",
      },
    ],
    endpoints: {
      me: "/api/auth/me",
      logout: "/api/auth/logout",
    },
  });
}
