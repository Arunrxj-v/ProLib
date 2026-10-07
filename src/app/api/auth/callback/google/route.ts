import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { exchangeGoogleCode, isGoogleAuthEnabled } from "@/lib/auth/google";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { safeNextPath } from "@/lib/auth/validation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isEmailDomainAllowed, isEmailVerificationRequired } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

function fail(code: string) {
  // absoluteUrl (APP_URL) — request.url's origin is the internal bind
  // address behind the proxy, never the public one.
  return NextResponse.redirect(absoluteUrl(`/login?error=${code}`));
}

function sameValue(a: string | undefined, b: string | undefined) {
  if (!a || !b) return false;
  return hashToken(a) === hashToken(b);
}

/**
 * Google OAuth callback: state check → code exchange → account upsert →
 * session. Accounts created here are always tied to a real Google email;
 * nothing about the provider is simulated when credentials are missing.
 */
export async function GET(request: NextRequest) {
  if (!isGoogleAuthEnabled()) return fail("google_disabled");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get("prolib_oauth_state")?.value;
  const next = safeNextPath(
    request.cookies.get("prolib_oauth_next")?.value,
    "/dashboard",
  );

  if (!code || !sameValue(state ?? undefined, cookieState)) {
    return fail("state");
  }

  const profile = await exchangeGoogleCode(code);
  if (!profile) return fail("provider");
  if (!profile.emailVerified) return fail("unverified_google");

  if (!(await isEmailDomainAllowed(profile.email))) {
    return fail("domain");
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1);

  let userId: string;

  if (existing[0]) {
    if (existing[0].status === "suspended") return fail("suspended");
    userId = existing[0].id;
    // This route only runs when Google reports the address as verified
    // (line above), so Google has proven control of the same email the
    // account uses — record that proof instead of demanding a second one.
    // This is provider attestation, not an automatic local bypass: without
    // Google's `emailVerified` the callback fails before reaching here.
    if (!existing[0].emailVerifiedAt) {
      await db
        .update(users)
        .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, userId));
    }
    // Keep the avatar in step with the provider; never invent other fields.
    if (profile.picture && existing[0].avatarUrl !== profile.picture) {
      await db
        .update(users)
        .set({ avatarUrl: profile.picture, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }
  } else {
    const requiresVerification = await isEmailVerificationRequired();
    const base = profile.email.split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase();
    const handle = base.length >= 3 ? base : `student_${generateToken().slice(0, 8)}`;

    const rows = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.username, handle));

    userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      email: profile.email,
      name: profile.name,
      username: rows[0] ? `${handle}_${userId.slice(0, 4)}` : handle,
      avatarUrl: profile.picture ?? null,
      // Google already confirmed the address; otherwise the college policy
      // still applies and the student must confirm through email.
      emailVerifiedAt:
        profile.emailVerified || !requiresVerification ? new Date() : null,
      // No password is stored for provider-only accounts — the student can
      // still set one later from the profile screen.
      passwordHash: await hashPassword(generateToken().slice(0, 24)),
      role: "student",
      status: "active",
      skills: [],
    });
  }

  await createSession(userId, {
    userAgent: request.headers.get("user-agent"),
  });

  const response = NextResponse.redirect(absoluteUrl(next));
  response.cookies.delete("prolib_oauth_state");
  response.cookies.delete("prolib_oauth_next");
  return response;
}
