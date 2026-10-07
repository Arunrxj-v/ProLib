/**
 * Authentication input contracts, shared by the server actions (authoritative
 * validation) and the client forms (inline error text).
 *
 * The server always re-validates: nothing the browser sends is trusted.
 */

import { z } from "zod";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_PATTERN = /^[a-z0-9_]+$/i;

export const PASSWORD_MIN = 10;

const password = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(200, "That password is too long.")
  .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), {
    message: "Mix letters and numbers.",
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your college email.")
    .max(160, "That email is too long.")
    .regex(EMAIL_PATTERN, "Enter a valid email address.")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Enter your password.").max(200),
  // `FormData.get()` yields `null` for a missing field, not `undefined`.
  next: z.string().nullish(),
});

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(80, "That name is too long."),
    username: z
      .string()
      .trim()
      .min(3, "Handles need at least 3 characters.")
      .max(30, "Handles can be at most 30 characters.")
      .regex(
        USERNAME_PATTERN,
        "Letters, numbers and underscores only — no spaces.",
      )
      .transform((value) => value.toLowerCase()),
    email: z
      .string()
      .trim()
      .min(1, "Enter your college email.")
      .max(160, "That email is too long.")
      .regex(EMAIL_PATTERN, "Enter a valid email address.")
      .transform((value) => value.toLowerCase()),
    password,
    confirm: z.string().min(1, "Repeat your password."),
    departmentId: z.string().nullish(),
    batch: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value !== "" ? Number(value) : undefined)),
    terms: z.string().nullish(),
    next: z.string().nullish(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  })
  .refine((value) => value.terms === "on", {
    path: ["terms"],
    message: "Please accept the project library guidelines.",
  })
  .refine(
    (value) =>
      value.batch === undefined ||
      (Number.isInteger(value.batch) &&
        value.batch >= 2000 &&
        value.batch <= new Date().getFullYear() + 1),
    { path: ["batch"], message: "Enter a valid graduation year." },
  );

export const resendSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your college email.")
    .regex(EMAIL_PATTERN, "Enter a valid email address.")
    .transform((value) => value.toLowerCase()),
});

export const verifySchema = z.object({
  token: z.string().trim().min(10, "That verification link is incomplete."),
});

export type FieldErrors = Record<string, string>;

/** Zod issue list → a flat `{ field: message }` map for the form. */
export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Only same-origin paths are ever redirected to, so a crafted `?next=` can
 * never bounce a signed-in student off-site.
 */
export function safeNextPath(
  raw: string | null | undefined,
  fallback: string,
): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\s<>"'\\]/.test(value)) return fallback;
  return value;
}
