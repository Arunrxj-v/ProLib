/**
 * Outbound mail boundary.
 *
 * ProLib never pretends to send email it cannot send:
 *
 *   1. `RESEND_API_KEY` (optional `EMAIL_FROM`) → real delivery via Resend.
 *   2. development/test → the link is printed to the server console and
 *      returned so the UI can offer a one-click "development" link.
 *   3. production without credentials → nothing is sent, and the caller tells
 *      the user to ask an administrator instead of silently dropping the mail.
 */

import "server-only";

import { SITE } from "@/lib/constants";
import { absoluteUrl } from "@/lib/utils";

export type MailResult = {
  /** True only when a real transport accepted the message. */
  delivered: boolean;
  /** Present only outside production when nothing is configured. */
  devLink?: string;
};

/**
 * §10: can this instance actually produce a verification link right now?
 *
 * Outside production the console/dev-link transport always counts; in
 * production a Resend key is required. Callers must refuse to create an
 * account (rather than silently dropping the mail) when this is false.
 */
export function mailCanSend(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

async function sendViaResend(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? `${SITE.name} <no-reply@prolib.edu>`,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function verificationLink(token: string, next?: string): string {
  // The email link points at the API endpoint that CONSUMES the token and
  // then redirects to a status page — opening the link is the verification
  // step; there is no in-app "verify" button to press (§29).
  const params = new URLSearchParams({ token });
  if (next) params.set("next", next);
  return absoluteUrl(`/api/auth/verify-email?${params.toString()}`);
}

/** Sends the single-use college-email confirmation link. */
export async function sendVerificationMail(input: {
  to: string;
  name: string;
  token: string;
  /** Where the student was heading before signing up — survives the
   *  verification detour inside the emailed link itself. */
  next?: string;
}): Promise<MailResult> {
  const link = verificationLink(input.token, input.next);
  const subject = `Verify your ${SITE.name} account`;
  const text = [
    `Hi ${input.name},`,
    "",
    `Welcome to ${SITE.name}.`,
    "Verify your email address to activate your account:",
    link,
    "",
    "The link works once and expires in 24 hours.",
    "",
    `— ${SITE.name}, ${SITE.tagline}`,
  ].join("\n");

  if (await sendViaResend({ to: input.to, subject, text })) {
    return { delivered: true };
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `\n[prolib mail] verification link for ${input.to}\n${link}\n`,
    );
    return { delivered: false, devLink: link };
  }

  console.warn(
    `[prolib mail] no transport configured (set RESEND_API_KEY); verification for ${input.to} not sent`,
  );
  return { delivered: false };
}
