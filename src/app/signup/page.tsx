import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignupForm } from "@/components/auth/AuthForms";
import { Eyebrow } from "@/components/ui/Tag";
import { getCurrentUser } from "@/lib/auth/session";
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
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");

  const next = first(params.next);
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
