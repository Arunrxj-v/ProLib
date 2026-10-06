"use server";

import { headers } from "next/headers";
import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroyCurrentSession,
} from "@/lib/auth/session";
import { consumeVerificationToken, issueVerificationToken } from "@/lib/auth/verification";
import {
  fieldErrorsOf,
  loginSchema,
  resendSchema,
  safeNextPath,
  signupSchema,
  verifySchema,
} from "@/lib/auth/validation";
import { db } from "@/lib/db";
import { departments, users } from "@/lib/db/schema";
import { sendVerificationMail } from "@/lib/mail";
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
    const mail = await sendVerificationMail({ to: email, name, token });

    if (mail.devLink) {
      // Development: no transport configured, so hand over the real link.
      redirect(mail.devLink);
    }
    redirect(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  await createSession(userId, await clientMeta());
  redirect(safeNextPath(next, "/dashboard"));
}

/* ------------------------------------------------------------------ */
/* College email confirmation                                          */
/* ------------------------------------------------------------------ */

export async function verifyEmailAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = verifySchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) {
    return { error: "That verification link is incomplete." };
  }

  const userId = await consumeVerificationToken(parsed.data.token);
  if (!userId) {
    return {
      error: "This confirmation link is invalid or has expired.",
      info: "Request a new link below — links last 24 hours and work once.",
    };
  }

  const rows = await db
    .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!rows[0]) {
    return { error: "This account no longer exists." };
  }

  if (!rows[0].emailVerifiedAt) {
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  redirect("/login?verified=1");
}

export async function resendVerificationAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resendSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  const generic = {
    info: "If an unverified ProLib account uses that address, a new confirmation link is on its way.",
    values: { email: parsed.data.email },
  };

  const user = rows[0];
  if (!user || user.emailVerifiedAt) return generic;

  const token = await issueVerificationToken(user.id);
  const mail = await sendVerificationMail({
    to: user.email,
    name: user.name,
    token,
  });

  return {
    ...generic,
    devVerifyUrl: mail.devLink,
  };
}

/* ------------------------------------------------------------------ */
/* Sign out                                                            */
/* ------------------------------------------------------------------ */

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/");
}

/** Re-exported so client forms can hash tokens they never need to see. */
