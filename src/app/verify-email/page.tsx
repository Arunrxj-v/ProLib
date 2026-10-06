import type { Metadata } from "next";
import Link from "next/link";

import {
  ResendForm,
  VerifyForm,
} from "@/components/auth/AuthForms";
import { Alert } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Tag";
import { first } from "@/lib/data/filters";

export const metadata: Metadata = {
  title: "Verify your college email",
  description: "Confirm the college email attached to your ProLib account.",
};

export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const params = await searchParams;
  const token = first(params.token);
  const email = first(params.email);
  const devReady = process.env.NODE_ENV !== "production";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-lg border border-gh-border bg-gh-card p-6 sm:p-8">
        <Eyebrow>College email</Eyebrow>

        {token ? (
          <>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-gh-fg-default">
              Confirm your email
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-gh-fg-muted">
              One click links this address to your account. The link works once
              and expires 24 hours after it was sent.
            </p>
            <div className="mt-6">
              <VerifyForm token={token} />
            </div>
          </>
        ) : email ? (
          <>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-gh-fg-default">
              Check your inbox
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-gh-fg-muted">
              If <span className="font-mono text-gh-accent">{email}</span> has a
              pending ProLib account, a confirmation link is on its way. It
              expires in 24 hours.
            </p>

            {devReady && (
              <div className="mt-4">
                <Alert tone="attention" title="Development mode">
                  No mail transport is configured on this server, so the link is
                  printed in the terminal running <code>npm run dev</code>.
                </Alert>
              </div>
            )}

            <div className="mt-6">
              <ResendForm email={email} editable={false} />
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-gh-fg-default">
              Resend confirmation
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-gh-fg-muted">
              Enter the college email you signed up with and we will issue a
              fresh single-use link.
            </p>
            <div className="mt-6">
              <ResendForm />
            </div>
          </>
        )}
      </div>

      <p className="mt-5 text-center text-sm text-gh-fg-muted">
        <Link href="/login" className="font-medium text-gh-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
