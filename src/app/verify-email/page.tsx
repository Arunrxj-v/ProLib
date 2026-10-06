import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ResendForm } from "@/components/auth/AuthForms";
import { Alert } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Tag";
import { first } from "@/lib/data/filters";

export const metadata: Metadata = {
  title: "Verify your college email",
  description: "Confirm the college email attached to your ProLib account.",
};

/** Same-origin only — `next` reaches here from the emailed link itself. */
function signInHref(next?: string): string {
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}

function SignInLink({ next }: { next?: string }) {
  return (
    <Link
      href={signInHref(next)}
      className="mt-6 inline-flex items-center justify-center rounded-md bg-gh-btn-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gh-btn-primary-hover"
    >
      Continue to sign in
    </Link>
  );
}

/**
 * Every face of the verification flow (§27), all server-rendered states:
 *
 *   status=verified  the token was consumed — account is verified
 *   status=already   same link opened twice (§7) — nothing re-verifies
 *   status=expired   link past its TTL (§12) — offer a fresh one
 *   status=invalid   unknown or superseded token (§13) — offer a fresh one
 *   ?email=          "check your inbox" right after sign-up (+ dev link)
 *   (nothing)        resend form for a student who lost the email
 *
 * There is deliberately no "verify" button anywhere: opening the emailed
 * URL is the only action that can mark an account verified (§29), and that
 * happens in /api/auth/verify-email before this page is ever reached.
 */
export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const params = await searchParams;
  const token = first(params.token);
  const status = first(params.status);
  const email = first(params.email);
  const next = first(params.next);
  const devToken = first(params.devToken);
  const sendFailed = first(params.send_failed) === "1";
  const devReady = process.env.NODE_ENV !== "production";

  // Bookmarked/legacy token URLs still run the real flow — forward to the
  // endpoint that consumes the token; never render the token here.
  if (token) {
    const target = new URLSearchParams({ token });
    if (next) target.set("next", next);
    redirect(`/api/auth/verify-email?${target.toString()}`);
  }

  let body: React.ReactNode;

  if (status === "verified") {
    body = (
      <>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gh-fg-default">
          Email verified
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-gh-fg-muted">
          Your college email is confirmed and your account is active. Sign in
          to start publishing projects.
        </p>
        <SignInLink next={next} />
      </>
    );
  } else if (status === "already") {
    body = (
      <>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gh-fg-default">
          Your email has already been verified.
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-gh-fg-muted">
          This confirmation link was already used, so there is nothing left to
          do — verification links work only once.
        </p>
        <SignInLink next={next} />
      </>
    );
  } else if (status === "expired") {
    body = (
      <>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gh-fg-default">
          Verification link expired.
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-gh-fg-muted">
          Links last 24 hours for safety. Request a fresh one below and open
          it promptly.
        </p>
        <div className="mt-6">
          <ResendForm next={next} />
        </div>
      </>
    );
  } else if (status === "invalid") {
    body = (
      <>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gh-fg-default">
          Invalid verification link.
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-gh-fg-muted">
          This link is not valid — it may have been superseded by a newer
          email or mistyped. Nothing was changed.
        </p>
        <div className="mt-6">
          <ResendForm next={next} />
        </div>
      </>
    );
  } else if (email) {
    body = (
      <>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gh-fg-default">
          Check your inbox
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-gh-fg-muted">
          We sent a confirmation link to{" "}
          <span className="font-mono text-gh-accent">{email}</span>. Open it to
          activate your account — it expires in 24 hours and works once.
        </p>

        {sendFailed && (
          <div className="mt-4">
            <Alert tone="danger" title="The confirmation email could not be sent.">
              The mail provider rejected the message. Try resending below, or
              ask your administrator to check the mail configuration.
            </Alert>
          </div>
        )}

        {devReady && (
          <div className="mt-4">
            <Alert tone="attention" title="Development mode">
              {devToken ? (
                <>
                  No mail transport is configured, so nothing left this server.
                  The real verification link was printed in the terminal running{" "}
                  <code>npm run dev</code>, or you can{" "}
                  <a
                    href={`/api/auth/verify-email?token=${encodeURIComponent(
                      devToken,
                    )}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
                    className="font-medium text-gh-accent underline underline-offset-2"
                  >
                    open the verification link directly
                  </a>
                  . The account stays unverified until that link is opened.
                </>
              ) : (
                <>
                  No mail transport is configured on this server, so the link
                  is printed in the terminal running <code>npm run dev</code>.
                </>
              )}
            </Alert>
          </div>
        )}

        <div className="mt-6">
          <ResendForm email={email} editable={false} next={next} />
        </div>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gh-fg-default">
          Resend confirmation
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-gh-fg-muted">
          Enter the college email you signed up with and we will issue a
          fresh single-use link.
        </p>
        <div className="mt-6">
          <ResendForm next={next} />
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-lg border border-gh-border bg-gh-card p-6 sm:p-8">
        <Eyebrow>College email</Eyebrow>
        {body}
      </div>

      <p className="mt-5 text-center text-sm text-gh-fg-muted">
        <Link href="/login" className="font-medium text-gh-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
