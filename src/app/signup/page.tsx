import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignupForm, GoogleButton, OrDivider } from "@/components/auth/AuthForms";
import { Eyebrow } from "@/components/ui/Tag";
import { isGoogleAuthEnabled } from "@/lib/auth/google";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/validation";
import { first } from "@/lib/data/filters";
import { getDepartments } from "@/lib/data/taxonomy";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create your ProLib student account and start publishing college projects.",
};

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const params = await searchParams;
  const next = first(params.next);
  const user = await getCurrentUser();
  if (user) {
    // Signed-in already? Leave — but honour ?next= (never back into an
    // auth screen, which would loop).
    const fallback = user.role === "admin" ? "/admin" : "/dashboard";
    const target = safeNextPath(next, fallback);
    redirect(target === "/login" || target === "/signup" ? fallback : target);
  }

  const departments = await getDepartments();

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6">
      <div className="rounded-lg border border-gh-border bg-gh-card p-6 sm:p-8">
        <Eyebrow>Join the library</Eyebrow>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gh-fg-default">
          Create your student account
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-gh-fg-muted">
          Your account is tied to a college email so reviewers can verify who
          built what. Nothing you submit is public until a moderator approves
          it.
        </p>

        <div className="mt-6">
          {/* Same OAuth flow as /login — the callback enforces the college
              domain gate and creates/links the account exactly as the form
              would; a Google sign-up is never a verification bypass. */}
          <GoogleButton
            enabled={isGoogleAuthEnabled()}
            href={`/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          />
          <OrDivider label="Or create account with email" />
          <SignupForm departments={departments} next={next} />
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-gh-fg-muted">
        Already have an account?{" "}
        <Link
          href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-gh-accent hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
