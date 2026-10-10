import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleButton, LoginForm, OrDivider } from "@/components/auth/AuthForms";
import { Alert } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Tag";
import { isGoogleAuthEnabled } from "@/lib/auth/google";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/validation";
import { first } from "@/lib/data/filters";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to publish and manage your college projects.",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const next = first(params.next);
  const user = await getCurrentUser();
  if (user) {
    // A genuinely signed-in visitor (session row verified) skips the form —
    // but honours ?next= so "Add Project → login → create page" completes.
    const fallback = user.role === "admin" ? "/admin" : "/dashboard";
    const target = safeNextPath(next, fallback);
    redirect(target === "/login" || target === "/signup" ? fallback : target);
  }
  const verified = first(params.verified) === "1";
  const denied = first(params.denied) === "1";
  const oauthError = first(params.error);

  const OAUTH_ERRORS: Record<string, { title: string; body: string }> = {
    google_disabled: {
      title: "Google sign-in is not configured",
      body: "This server has no GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET or ALLOWED_COLLEGE_EMAIL_DOMAINS set, so the provider is disabled rather than faked. Sign in with your password instead.",
    },
    state: {
      title: "Sign-in could not be confirmed",
      body: "The OAuth round trip did not match this browser. Try again.",
    },
    provider: {
      title: "Google did not return a profile",
      body: "The authorization was declined or expired. Try again, or sign in with your password.",
    },
    cancelled: {
      title: "Google sign-in was cancelled",
      body: "You stopped before finishing the Google authorization. Nothing was created — try again, or sign in with your password.",
    },
    domain: {
      title: "This college domain is not allowed",
      body: "Only college Google accounts can be used with ProLib.",
    },
    unverified_google: {
      title: "Google account is not verified",
      body: "Use a Google account with a confirmed email address, or sign in with your password.",
    },
    suspended: {
      title: "Account suspended",
      body: "This account has been suspended. Contact your college administrator.",
    },
  };
  const oauth = oauthError ? OAUTH_ERRORS[oauthError] : undefined;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-lg border border-gh-border bg-gh-card p-6 sm:p-8">
        <Eyebrow>Student access</Eyebrow>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gh-fg-default">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-gh-fg-muted">
          Sign in with the college email your project submissions are tied to.
        </p>

        <div className="mt-5 space-y-3">
          {verified && (
            <Alert tone="success" title="Email confirmed">
              Your college email is verified — you can sign in now.
            </Alert>
          )}
          {denied && (
            <Alert tone="attention" title="Administrator area">
              That screen is only available to department moderators. Sign in
              with an administrator account to continue.
            </Alert>
          )}
          {oauth && (
            <Alert tone="danger" title={oauth.title}>
              {oauth.body}
            </Alert>
          )}
        </div>

        <div className={verified || denied || oauth ? "mt-5" : "mt-6"}>
          <GoogleButton
            enabled={isGoogleAuthEnabled()}
            href={`/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          />
          <OrDivider label="Or sign in with email" />
          <LoginForm next={next} />
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-gh-fg-muted">
        No account yet?{" "}
        <Link
          href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-gh-accent hover:underline"
        >
          Create one with your college email
        </Link>
      </p>
    </div>
  );
}
