"use server";

import { headers } from "next/headers";
import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroyCurrentSession,
} from "@/lib/auth/session";
import {
  issueVerificationToken,
  verificationSendGate,
} from "@/lib/auth/verification";
import {
  fieldErrorsOf,
  loginSchema,
  resendSchema,
  safeNextPath,
  signupSchema,
} from "@/lib/auth/validation";
import { db } from "@/lib/db";
import { departments, users } from "@/lib/db/schema";
import { mailCanSend, sendVerificationMail } from "@/lib/mail";
import { isEmailDomainAllowed, isEmailVerificationRequired } from "@/lib/settings";

export type AuthState = {
  error?: string;
  info?: string;
  fieldErrors?: Record<string, string>;
  /** Fields to repopulate after a failed submit (never the password). */
  values?: Record<string, string>;
  /** Set when sign-in is blocked only by an unconfirmed college email. */
  needsVerification?: boolean;
  /** Development-only one-click link when no mail transport is configured. */
  devVerifyUrl?: string;
};

function valuesOf(formData: FormData, keys: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

async function clientMeta() {
  const headerStore = await headers();
  return { userAgent: headerStore.get("user-agent") };
}

/* ------------------------------------------------------------------ */
/* Sign in                                                             */
/* ------------------------------------------------------------------ */

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const values = valuesOf(formData, ["email", "next"]);
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  const user = rows[0];

  // Same message for "unknown account" and "wrong password" — no enumeration.
  const invalid = { error: "Email or password is incorrect.", values };

  if (!user || !user.passwordHash) return invalid;
  if (user.status === "suspended") {
    return {
      error: "This account is suspended. Contact your college administrator.",
      values,
    };
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return invalid;

  if ((await isEmailVerificationRequired()) && !user.emailVerifiedAt) {
    return {
      error: "Confirm your college email before signing in.",
      info: `We can send a fresh confirmation link to ${user.email}.`,
      needsVerification: true,
      values,
    };
  }

  await createSession(user.id, await clientMeta());

  const fallback = user.role === "admin" ? "/admin" : "/dashboard";
  redirect(safeNextPath(parsed.data.next, fallback));
}

/* ------------------------------------------------------------------ */
/* Create account                                                      */
/* ------------------------------------------------------------------ */

export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const values = valuesOf(formData, [
    "name",
    "username",
    "email",
    "departmentId",
    "batch",
    "next",
  ]);

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    departmentId: formData.get("departmentId") ?? undefined,
    batch: formData.get("batch") ?? undefined,
    terms: formData.get("terms") ?? undefined,
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const { name, username, email, password, departmentId, batch, next } =
    parsed.data;

  if (!(await isEmailDomainAllowed(email))) {
    return {
      error: "Only college email addresses can sign up on this instance.",
      values,
    };
  }

  const clash = await db
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)));

  const fieldErrors: Record<string, string> = {};
  if (clash.some((row) => row.email === email)) {
    fieldErrors.email = "An account already uses this email.";
  }
  if (clash.some((row) => row.username === username)) {
    fieldErrors.username = "That handle is taken.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values };
  }

  let department: { id: string } | null = null;
  if (departmentId) {
    const rows = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);
    department = rows[0] ?? null;
    if (!department) {
      return {
        fieldErrors: { departmentId: "Choose a department from the list." },
        values,
      };
    }
  }

  const requiresVerification = await isEmailVerificationRequired();

  // §10: refuse to create an account this instance cannot send a real
  // verification link for — never silently drop the mail and never
  // auto-verify as a shortcut.
  if (requiresVerification && !mailCanSend()) {
    return {
      error: "Email verification is not configured on this server.",
      info: "Configure the email provider (RESEND_API_KEY, EMAIL_FROM) before creating accounts — ProLib never verifies an account without the emailed link.",
      values,
    };
  }

  const userId = crypto.randomUUID();

  await db.insert(users).values({
    id: userId,
    email,
    name,
    username,
    passwordHash: await hashPassword(password),
    emailVerifiedAt: requiresVerification ? null : new Date(),
    departmentId: department?.id ?? null,
    batch: batch ?? null,
    role: "student",
    status: "active",
    skills: [],
  });

  if (requiresVerification) {
    const token = await issueVerificationToken(userId);
    const mail = await sendVerificationMail({
      to: email,
      name,
      token,
      next: next ?? undefined,
    });

    // Land on "check your inbox" — never on a page that holds the token.
    // The account stays unverified until the emailed link (the only proof
    // of control of the address) is opened (§3, §29). Off-production with
    // no transport, the same token URL the email would carry is attached
    // as a clearly marked development-only inspection link (§10).
    const params = new URLSearchParams({ email });
    if (next) params.set("next", next);
    if (mail.delivered || mail.devLink) {
      if (mail.devLink) {
        const raw = new URL(mail.devLink).searchParams.get("token");
        if (raw) params.set("devToken", raw);
      }
      redirect(`/verify-email?${params.toString()}`);
    }
    // Configured, but the provider rejected the send — say so instead of
    // pretending an email is on its way.
    params.set("send_failed", "1");
    redirect(`/verify-email?${params.toString()}`);
  }

  await createSession(userId, await clientMeta());
  redirect(safeNextPath(next, "/dashboard"));
}

/* ------------------------------------------------------------------ */
/* College email confirmation                                          */
/* ------------------------------------------------------------------ */

export async function resendVerificationAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resendSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const values = { email: parsed.data.email };

  // §10: a production instance without a mail provider must not pretend
  // anything was sent.
  if (!mailCanSend()) {
    return {
      error: "Email verification is not configured on this server.",
      info: "Ask your administrator to configure the email provider (RESEND_API_KEY, EMAIL_FROM).",
      values,
    };
  }

  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  const generic = {
    info: "If an unverified ProLib account uses that address, a new confirmation link is on its way.",
    values,
  };

  const user = rows[0];
  if (!user || user.emailVerifiedAt) return generic;

  // §11: no unlimited verification-email spam — one per minute, a few per
  // hour, counted across superseded links as well.
  const gate = await verificationSendGate(user.id);
  if (gate.blocked) return { error: gate.message, values };

  // Keep the student's original destination alive inside the new link.
  const rawNext = formData.get("next");
  const next =
    typeof rawNext === "string" && rawNext
      ? safeNextPath(rawNext, "") || undefined
      : undefined;

  const token = await issueVerificationToken(user.id);
  const mail = await sendVerificationMail({
    to: user.email,
    name: user.name,
    token,
    next,
  });

  if (mail.delivered) return generic;
  if (mail.devLink) return { ...generic, devVerifyUrl: mail.devLink };
  return {
    error: "The confirmation email could not be sent.",
    info: "The mail provider rejected the message — try again shortly.",
    values,
  };
}

/* ------------------------------------------------------------------ */
/* Sign out                                                            */
/* ------------------------------------------------------------------ */

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/");
}

